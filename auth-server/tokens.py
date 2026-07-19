"""ניהול מפתח החתימה של שירות ה-Auth והנפקת טוקני גישה (ES256).

המפתח הפרטי חי רק בשירות הזה; שרת התוכן מאמת טוקנים מול המפתח הציבורי
שנחשף ב-/.well-known/jwks.json — כך שלשרת התוכן אין יכולת חתימה.
"""

import base64
import hashlib
import os
import time
from pathlib import Path

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

ISSUER = "ironnets-auth"
AUDIENCE = "ironnets-api"
ACCESS_TOKEN_TTL_SECONDS = 30 * 60

_private_key: ec.EllipticCurvePrivateKey | None = None
_kid = ""


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def load_signing_key() -> None:
    """טוען את מפתח החתימה מהקובץ, או יוצר חדש בהרצה ראשונה (ונשמר ב-volume)."""
    global _private_key, _kid
    key_file = Path(os.environ.get("AUTH_JWT_KEY_FILE", "jwt-signing-key.pem"))
    if key_file.exists():
        key = serialization.load_pem_private_key(
            key_file.read_bytes(), password=None
        )
        if not isinstance(key, ec.EllipticCurvePrivateKey):
            raise RuntimeError("AUTH_JWT_KEY_FILE חייב להכיל מפתח EC (P-256)")
        _private_key = key
    else:
        _private_key = ec.generate_private_key(ec.SECP256R1())
        pem = _private_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
        key_file.parent.mkdir(parents=True, exist_ok=True)
        key_file.write_bytes(pem)
        try:
            key_file.chmod(0o600)
        except OSError:
            pass
    numbers = _private_key.public_key().public_numbers()
    _kid = hashlib.sha256(
        numbers.x.to_bytes(32, "big") + numbers.y.to_bytes(32, "big")
    ).hexdigest()[:16]


def jwks() -> dict:
    numbers = _private_key.public_key().public_numbers()
    return {
        "keys": [
            {
                "kty": "EC",
                "crv": "P-256",
                "use": "sig",
                "alg": "ES256",
                "kid": _kid,
                "x": _b64url(numbers.x.to_bytes(32, "big")),
                "y": _b64url(numbers.y.to_bytes(32, "big")),
            }
        ]
    }


def issue_access_token(user_id: str) -> tuple[str, int]:
    now = int(time.time())
    token = jwt.encode(
        {
            "iss": ISSUER,
            "aud": AUDIENCE,
            "sub": user_id,
            "iat": now,
            "exp": now + ACCESS_TOKEN_TTL_SECONDS,
        },
        _private_key,
        algorithm="ES256",
        headers={"kid": _kid},
    )
    return token, ACCESS_TOKEN_TTL_SECONDS


def verify_access_token(token: str) -> dict:
    """אימות מקומי של טוקן גישה (ל-GET /auth/me)."""
    return jwt.decode(
        token,
        _private_key.public_key(),
        algorithms=["ES256"],
        audience=AUDIENCE,
        issuer=ISSUER,
    )
