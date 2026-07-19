"""חיבור ל-Postgres (סכמת content בלבד) ומיגרציה באתחול.

מתחבר עם ה-role הייעודי ironnets_content, שאין לו גישה לסכמת auth —
כך שגם פריצה לשרת התוכן אינה חושפת משתמשים או refresh tokens.
"""

import asyncio
import os

import asyncpg
from fastapi import HTTPException

_pool: asyncpg.Pool | None = None
_pool_lock = asyncio.Lock()

MIGRATION = """
CREATE TABLE IF NOT EXISTS content.orders (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    title text NOT NULL DEFAULT '',
    data jsonb NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_user_idx
    ON content.orders (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS content.plan_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES content.orders(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    name text NOT NULL,
    size_bytes bigint NOT NULL,
    stored_path text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_files_order_idx
    ON content.plan_files (order_id);
"""


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is not None:
        return _pool
    async with _pool_lock:
        if _pool is not None:
            return _pool
        url = os.environ.get("CONTENT_DATABASE_URL", "").strip()
        if not url:
            raise HTTPException(
                status_code=503,
                detail="שמירת הזמנות בשרת אינה מוגדרת (CONTENT_DATABASE_URL)",
            )
        try:
            pool = await asyncpg.create_pool(url, min_size=1, max_size=5)
            async with pool.acquire() as conn:
                await conn.execute(MIGRATION)
        except (OSError, asyncpg.PostgresError) as exc:
            raise HTTPException(
                status_code=503, detail="אין חיבור לבסיס הנתונים"
            ) from exc
        _pool = pool
        return _pool
