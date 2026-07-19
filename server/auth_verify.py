"""אימות טוקני גישה שהונפקו על-ידי שירות ה-Auth הנפרד.

השרת הזה לא מחזיק שום סוד חתימה — הוא מאמת חתימות ES256 מול המפתח
הציבורי שנמשך מ-JWKS של שירות ה-Auth (עם קאש והתחדשות בהחלפת מפתח).
"""

import os
import time

import httpx
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

AUDIENCE = "ironnets-api"
ISSUER = "ironnets-auth"
_JWKS_TTL_SECONDS = 600

_bearer = HTTPBearer(auto_error=False)
_jwks_cache: dict | None = None
_jwks_fetched_at = 0.0


def _jwks_url() -> str:
    return os.environ.get(
        "AUTH_JWKS_URL", "http://auth:8100/.well-known/jwks.json"
    ).strip()


async def _get_jwks(force: bool = False) -> dict:
    global _jwks_cache, _jwks_fetched_at
    if (
        not force
        and _jwks_cache is not None
        and time.time() - _jwks_fetched_at < _JWKS_TTL_SECONDS
    ):
        return _jwks_cache
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(_jwks_url())
            response.raise_for_status()
            _jwks_cache = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        if _jwks_cache is not None:
            return _jwks_cache
        raise HTTPException(
            status_code=503, detail="שירות ההתחברות אינו זמין"
        ) from exc
    _jwks_fetched_at = time.time()
    return _jwks_cache


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    """תלות FastAPI: מחלץ את מזהה המשתמש מטוקן ה-Bearer, או 401."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="נדרשת התחברות")
    token = credentials.credentials
    try:
        kid = jwt.get_unverified_header(token).get("kid")
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="טוקן גישה לא תקין") from exc

    key_data = None
    for force in (False, True):
        jwks = await _get_jwks(force)
        key_data = next(
            (k for k in jwks.get("keys", []) if k.get("kid") == kid), None
        )
        if key_data is not None:
            break
    if key_data is None:
        raise HTTPException(status_code=401, detail="טוקן גישה לא תקין")

    try:
        claims = jwt.decode(
            token,
            jwt.PyJWK(key_data).key,
            algorithms=["ES256"],
            audience=AUDIENCE,
            issuer=ISSUER,
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=401, detail="טוקן הגישה אינו תקין או שפג תוקפו"
        ) from exc
    return claims["sub"]
