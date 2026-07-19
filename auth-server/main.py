"""IronNets auth service.

שירות התחברות נפרד משרת העיבוד/תוכן, עם סכמת DB ומשתמש DB משלו:
- POST /auth/login    — התחברות עם Google (code+PKCE או ID token) או Apple
- POST /auth/refresh  — חידוש טוקן גישה (רוטציה + זיהוי שימוש חוזר)
- POST /auth/logout   — ביטול משפחת ה-refresh tokens
- GET  /auth/me       — פרטי המשתמש המחובר
- GET  /.well-known/jwks.json — מפתח ציבורי לאימות טוקנים בשרת התוכן
- GET  /health

Run: uvicorn main:app --host 0.0.0.0 --port 8100
"""

import hashlib
import secrets
import uuid
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env")

import jwt as pyjwt  # noqa: E402

import db  # noqa: E402
import providers  # noqa: E402
import tokens  # noqa: E402

REFRESH_TOKEN_DAYS = 90

app = FastAPI(title="IronNets Auth")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

tokens.load_signing_key()

_bearer = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    provider: Literal["google", "apple"]
    idToken: str | None = None
    # זרימת code+PKCE של Google — ההחלפה נעשית בצד השרת
    code: str | None = None
    codeVerifier: str | None = None
    redirectUri: str | None = None
    clientId: str | None = None
    # Apple מוסרת את השם רק בהתחברות הראשונה — הקליינט מעביר אותו במפורש
    fullName: str | None = None


class RefreshRequest(BaseModel):
    refreshToken: str


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _user_payload(row) -> dict:
    return {
        "id": str(row["id"]),
        "provider": row["provider"],
        "email": row["email"],
        "name": row["display_name"],
    }


async def _issue_session(conn, user_row, family_id: uuid.UUID | None = None) -> dict:
    refresh_token = secrets.token_urlsafe(48)
    await conn.execute(
        """
        INSERT INTO auth.refresh_tokens (user_id, token_hash, family_id, expires_at)
        VALUES ($1, $2, $3, now() + make_interval(days => $4))
        """,
        user_row["id"],
        _hash_token(refresh_token),
        family_id or uuid.uuid4(),
        REFRESH_TOKEN_DAYS,
    )
    access_token, expires_in = tokens.issue_access_token(str(user_row["id"]))
    return {
        "user": _user_payload(user_row),
        "accessToken": access_token,
        "accessTokenExpiresIn": expires_in,
        "refreshToken": refresh_token,
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/.well-known/jwks.json")
def jwks() -> dict:
    return tokens.jwks()


@app.post("/auth/login")
async def login(body: LoginRequest) -> dict:
    if body.provider == "apple":
        if not body.idToken:
            raise HTTPException(status_code=400, detail="חסר idToken")
        claims = providers.verify_apple_id_token(body.idToken)
        display_name = (body.fullName or "").strip() or None
    else:
        if body.code:
            if not (body.codeVerifier and body.redirectUri and body.clientId):
                raise HTTPException(
                    status_code=400,
                    detail="חסרים codeVerifier / redirectUri / clientId",
                )
            id_token = await providers.exchange_google_code(
                body.code, body.codeVerifier, body.redirectUri, body.clientId
            )
        elif body.idToken:
            id_token = body.idToken
        else:
            raise HTTPException(status_code=400, detail="חסר code או idToken")
        claims = providers.verify_google_id_token(id_token)
        display_name = (claims.get("name") or "").strip() or None

    pool = await db.get_pool()
    async with pool.acquire() as conn:
        user_row = await conn.fetchrow(
            """
            INSERT INTO auth.users (provider, provider_sub, email, display_name)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (provider, provider_sub) DO UPDATE SET
                email = COALESCE(EXCLUDED.email, auth.users.email),
                display_name = COALESCE(EXCLUDED.display_name, auth.users.display_name),
                last_login_at = now()
            RETURNING id, provider, email, display_name
            """,
            body.provider,
            claims["sub"],
            claims.get("email"),
            display_name,
        )
        return await _issue_session(conn, user_row)


@app.post("/auth/refresh")
async def refresh(body: RefreshRequest) -> dict:
    token_hash = _hash_token(body.refreshToken)
    pool = await db.get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                SELECT id, user_id, family_id, expires_at, revoked_at
                FROM auth.refresh_tokens
                WHERE token_hash = $1
                FOR UPDATE
                """,
                token_hash,
            )
            if row is None:
                raise HTTPException(
                    status_code=401, detail="ההתחברות פגה — נדרשת התחברות מחדש"
                )
            if row["revoked_at"] is not None:
                # שימוש חוזר בטוקן שהוחלף = חשד לגניבה — מבטלים את כל המשפחה
                await conn.execute(
                    """
                    UPDATE auth.refresh_tokens SET revoked_at = now()
                    WHERE family_id = $1 AND revoked_at IS NULL
                    """,
                    row["family_id"],
                )
                raise HTTPException(
                    status_code=401, detail="ההתחברות פגה — נדרשת התחברות מחדש"
                )
            expired = await conn.fetchval(
                "SELECT $1::timestamptz < now()", row["expires_at"]
            )
            if expired:
                raise HTTPException(
                    status_code=401, detail="ההתחברות פגה — נדרשת התחברות מחדש"
                )
            await conn.execute(
                "UPDATE auth.refresh_tokens SET revoked_at = now() WHERE id = $1",
                row["id"],
            )
            user_row = await conn.fetchrow(
                "SELECT id, provider, email, display_name FROM auth.users WHERE id = $1",
                row["user_id"],
            )
            if user_row is None:
                raise HTTPException(status_code=401, detail="המשתמש נמחק")
            return await _issue_session(conn, user_row, row["family_id"])


@app.post("/auth/logout", status_code=204)
async def logout(body: RefreshRequest) -> None:
    pool = await db.get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE auth.refresh_tokens SET revoked_at = now()
            WHERE family_id = (
                SELECT family_id FROM auth.refresh_tokens WHERE token_hash = $1
            ) AND revoked_at IS NULL
            """,
            _hash_token(body.refreshToken),
        )


@app.get("/auth/me")
async def me(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="חסר טוקן גישה")
    try:
        claims = tokens.verify_access_token(credentials.credentials)
    except pyjwt.PyJWTError as exc:
        raise HTTPException(
            status_code=401, detail="טוקן הגישה אינו תקין או שפג תוקפו"
        ) from exc
    pool = await db.get_pool()
    async with pool.acquire() as conn:
        user_row = await conn.fetchrow(
            "SELECT id, provider, email, display_name FROM auth.users WHERE id = $1",
            uuid.UUID(claims["sub"]),
        )
    if user_row is None:
        raise HTTPException(status_code=401, detail="המשתמש נמחק")
    return {"user": _user_payload(user_row)}
