"""חיבור ל-Postgres (סכמת auth בלבד) ומיגרציה באתחול.

השירות מתחבר עם ה-role הייעודי ironnets_auth, שהוא הבעלים של סכמת auth
ואין לו שום הרשאה על סכמת content — הפרדת אבטחה ברמת בסיס הנתונים.
"""

import asyncio
import os

import asyncpg

_pool: asyncpg.Pool | None = None
_pool_lock = asyncio.Lock()

MIGRATION = """
CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,
    provider_sub text NOT NULL,
    email text,
    display_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_sub)
);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    family_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx
    ON auth.refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_family_idx
    ON auth.refresh_tokens (family_id);
"""


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is not None:
        return _pool
    async with _pool_lock:
        if _pool is not None:
            return _pool
        url = os.environ.get("AUTH_DATABASE_URL", "").strip()
        if not url:
            raise RuntimeError("AUTH_DATABASE_URL אינו מוגדר")
        pool = await asyncpg.create_pool(url, min_size=1, max_size=5)
        async with pool.acquire() as conn:
            await conn.execute(MIGRATION)
        _pool = pool
        return _pool
