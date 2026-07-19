"""אימות אסימוני זהות (ID tokens) של Google ו-Apple.

העיקרון: לעולם לא סומכים על פרופיל שהקליינט שולח — מאמתים חתימה
קריפטוגרפית מול המפתחות הציבוריים של הספק, ובודקים שה-audience הוא
אחד מה-client IDs / bundle IDs שלנו.

עבור Google בזרימת code+PKCE, החלפת הקוד נעשית כאן בצד השרת — כך
שה-client secret של אפליקציית הווב לעולם לא מגיע לקליינט.
"""

import os

import httpx
import jwt
from fastapi import HTTPException

GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
APPLE_ISSUER = "https://appleid.apple.com"

_google_jwk_client = jwt.PyJWKClient(GOOGLE_JWKS_URL, cache_keys=True)
_apple_jwk_client = jwt.PyJWKClient(APPLE_JWKS_URL, cache_keys=True)


def _env_list(name: str) -> list[str]:
    return [v.strip() for v in os.environ.get(name, "").split(",") if v.strip()]


def google_client_ids() -> list[str]:
    return _env_list("GOOGLE_CLIENT_IDS")


def apple_bundle_ids() -> list[str]:
    return _env_list("APPLE_BUNDLE_IDS")


def _decode_id_token(
    token: str,
    jwk_client: jwt.PyJWKClient,
    audiences: list[str],
    issuers: set[str],
    provider_label: str,
) -> dict:
    if not audiences:
        raise HTTPException(
            status_code=503,
            detail=f"התחברות עם {provider_label} אינה מוגדרת בשרת",
        )
    try:
        key = jwk_client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            key.key,
            algorithms=["RS256", "ES256"],
            audience=audiences,
            options={"verify_iss": False},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=401, detail="אסימון הזהות אינו תקין או שפג תוקפו"
        ) from exc
    if claims.get("iss") not in issuers:
        raise HTTPException(status_code=401, detail="מנפיק האסימון אינו מוכר")
    if not claims.get("sub"):
        raise HTTPException(status_code=401, detail="אסימון ללא מזהה משתמש")
    return claims


def verify_google_id_token(token: str) -> dict:
    return _decode_id_token(
        token, _google_jwk_client, google_client_ids(), GOOGLE_ISSUERS, "Google"
    )


def verify_apple_id_token(token: str) -> dict:
    return _decode_id_token(
        token, _apple_jwk_client, apple_bundle_ids(), {APPLE_ISSUER}, "Apple"
    )


async def exchange_google_code(
    code: str, code_verifier: str, redirect_uri: str, client_id: str
) -> str:
    """מחליף authorization code ב-ID token מול Google ומחזיר אותו (לא מאומת)."""
    if client_id not in google_client_ids():
        raise HTTPException(status_code=400, detail="client_id אינו מוכר")
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "code_verifier": code_verifier,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
    }
    # להחלפת קוד של אפליקציית ווב Google דורשת client secret — הוא נשמר רק כאן
    web_client_id = os.environ.get("GOOGLE_WEB_CLIENT_ID", "").strip()
    web_secret = os.environ.get("GOOGLE_WEB_CLIENT_SECRET", "").strip()
    if client_id == web_client_id and web_secret:
        data["client_secret"] = web_secret
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            response = await client.post(GOOGLE_TOKEN_URL, data=data)
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=502, detail="אין חיבור לשרתי Google"
            ) from exc
    if response.status_code != 200:
        raise HTTPException(
            status_code=401, detail="החלפת הקוד מול Google נכשלה"
        )
    id_token = response.json().get("id_token")
    if not id_token:
        raise HTTPException(
            status_code=401, detail="Google לא החזירה אסימון זהות"
        )
    return id_token
