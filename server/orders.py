"""הזמנות של משתמשים מחוברים — שמירה, שליפה וקבצי תוכניות מצורפים.

כל נקודות הקצה דורשות טוקן גישה; מזהה המשתמש נגזר תמיד מהטוקן המאומת
ולעולם לא מגוף הבקשה, וכל שאילתה מסוננת לפיו — משתמש לא יכול לגשת
להזמנות של אחרים. קבצי תוכניות נשמרים על דיסק (volume) עם רשומת
מטא-דאטה ב-DB, ורק אם המשתמש בחר להעלות אותם.
"""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

import content_db
from auth_verify import get_current_user_id

router = APIRouter()

MAX_ORDER_BYTES = 2 * 1024 * 1024
MAX_PLAN_FILE_BYTES = 40 * 1024 * 1024
MAX_FILES_PER_ORDER = 10


def _files_dir() -> Path:
    path = Path(os.environ.get("PLAN_FILES_DIR", "plan-files"))
    path.mkdir(parents=True, exist_ok=True)
    return path


def _parse_uuid(value: str, label: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail=f"מזהה {label} אינו תקין"
        ) from exc


def _parse_created_at(order: dict) -> datetime:
    raw = order.get("createdAt")
    if isinstance(raw, str):
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed
        except ValueError:
            pass
    return datetime.now(timezone.utc)


class PutOrderRequest(BaseModel):
    order: dict


@router.get("/orders")
async def list_orders(user_id: str = Depends(get_current_user_id)) -> dict:
    pool = await content_db.get_pool()
    rows = await pool.fetch(
        """
        SELECT id, title, created_at, updated_at
        FROM content.orders WHERE user_id = $1
        ORDER BY updated_at DESC
        """,
        uuid.UUID(user_id),
    )
    return {
        "orders": [
            {
                "id": str(r["id"]),
                "title": r["title"],
                "createdAt": r["created_at"].isoformat(),
                "updatedAt": r["updated_at"].isoformat(),
            }
            for r in rows
        ]
    }


@router.get("/orders/{order_id}")
async def get_order(
    order_id: str, user_id: str = Depends(get_current_user_id)
) -> dict:
    oid = _parse_uuid(order_id, "הזמנה")
    pool = await content_db.get_pool()
    row = await pool.fetchrow(
        "SELECT data, updated_at FROM content.orders WHERE id = $1 AND user_id = $2",
        oid,
        uuid.UUID(user_id),
    )
    if row is None:
        raise HTTPException(status_code=404, detail="ההזמנה לא נמצאה")
    files = await pool.fetch(
        "SELECT id, name, size_bytes FROM content.plan_files WHERE order_id = $1",
        oid,
    )
    return {
        "order": json.loads(row["data"]),
        "updatedAt": row["updated_at"].isoformat(),
        "files": [
            {"id": str(f["id"]), "name": f["name"], "sizeBytes": f["size_bytes"]}
            for f in files
        ],
    }


@router.put("/orders/{order_id}")
async def put_order(
    order_id: str,
    body: PutOrderRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict:
    oid = _parse_uuid(order_id, "הזמנה")
    if body.order.get("id") != order_id:
        raise HTTPException(
            status_code=400, detail="מזהה ההזמנה בגוף אינו תואם לנתיב"
        )
    data = json.dumps(body.order, ensure_ascii=False)
    if len(data.encode()) > MAX_ORDER_BYTES:
        raise HTTPException(status_code=413, detail="ההזמנה גדולה מדי")
    pool = await content_db.get_pool()
    # ה-upsert מותנה בבעלות: אם ה-id קיים אצל משתמש אחר — לא יוחזר כלום
    row = await pool.fetchrow(
        """
        INSERT INTO content.orders (id, user_id, title, data, created_at, updated_at)
        VALUES ($1, $2, $3, $4::jsonb, $5, now())
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            data = EXCLUDED.data,
            updated_at = now()
        WHERE content.orders.user_id = EXCLUDED.user_id
        RETURNING updated_at
        """,
        oid,
        uuid.UUID(user_id),
        str(body.order.get("title") or ""),
        data,
        _parse_created_at(body.order),
    )
    if row is None:
        raise HTTPException(status_code=403, detail="אין הרשאה להזמנה זו")
    return {"updatedAt": row["updated_at"].isoformat()}


@router.delete("/orders/{order_id}", status_code=204)
async def delete_order(
    order_id: str, user_id: str = Depends(get_current_user_id)
) -> None:
    oid = _parse_uuid(order_id, "הזמנה")
    pool = await content_db.get_pool()
    paths = await pool.fetch(
        "SELECT stored_path FROM content.plan_files WHERE order_id = $1 AND user_id = $2",
        oid,
        uuid.UUID(user_id),
    )
    deleted = await pool.fetchval(
        "DELETE FROM content.orders WHERE id = $1 AND user_id = $2 RETURNING id",
        oid,
        uuid.UUID(user_id),
    )
    if deleted is None:
        return
    for record in paths:
        try:
            Path(record["stored_path"]).unlink(missing_ok=True)
        except OSError:
            pass


async def _require_order(pool, oid: uuid.UUID, user_id: str) -> None:
    exists = await pool.fetchval(
        "SELECT 1 FROM content.orders WHERE id = $1 AND user_id = $2",
        oid,
        uuid.UUID(user_id),
    )
    if exists is None:
        raise HTTPException(status_code=404, detail="ההזמנה לא נמצאה")


@router.post("/orders/{order_id}/files")
async def upload_plan_file(
    order_id: str,
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    oid = _parse_uuid(order_id, "הזמנה")
    pool = await content_db.get_pool()
    await _require_order(pool, oid, user_id)

    count = await pool.fetchval(
        "SELECT count(*) FROM content.plan_files WHERE order_id = $1", oid
    )
    if count >= MAX_FILES_PER_ORDER:
        raise HTTPException(status_code=409, detail="יותר מדי קבצים להזמנה")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="קובץ ריק")
    if len(data) > MAX_PLAN_FILE_BYTES:
        raise HTTPException(status_code=413, detail="הקובץ גדול מדי (מעל 40MB)")

    file_id = uuid.uuid4()
    stored_path = _files_dir() / f"{file_id}.pdf"
    stored_path.write_bytes(data)
    try:
        await pool.execute(
            """
            INSERT INTO content.plan_files
                (id, order_id, user_id, name, size_bytes, stored_path)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            file_id,
            oid,
            uuid.UUID(user_id),
            file.filename or "plan.pdf",
            len(data),
            str(stored_path),
        )
    except Exception:
        stored_path.unlink(missing_ok=True)
        raise
    return {"id": str(file_id), "name": file.filename or "plan.pdf"}


@router.get("/orders/{order_id}/files/{file_id}")
async def download_plan_file(
    order_id: str,
    file_id: str,
    user_id: str = Depends(get_current_user_id),
) -> FileResponse:
    oid = _parse_uuid(order_id, "הזמנה")
    fid = _parse_uuid(file_id, "קובץ")
    pool = await content_db.get_pool()
    row = await pool.fetchrow(
        """
        SELECT name, stored_path FROM content.plan_files
        WHERE id = $1 AND order_id = $2 AND user_id = $3
        """,
        fid,
        oid,
        uuid.UUID(user_id),
    )
    if row is None or not Path(row["stored_path"]).exists():
        raise HTTPException(status_code=404, detail="הקובץ לא נמצא")
    return FileResponse(
        row["stored_path"], media_type="application/pdf", filename=row["name"]
    )


@router.delete("/orders/{order_id}/files/{file_id}", status_code=204)
async def delete_plan_file(
    order_id: str,
    file_id: str,
    user_id: str = Depends(get_current_user_id),
) -> None:
    oid = _parse_uuid(order_id, "הזמנה")
    fid = _parse_uuid(file_id, "קובץ")
    pool = await content_db.get_pool()
    row = await pool.fetchrow(
        """
        DELETE FROM content.plan_files
        WHERE id = $1 AND order_id = $2 AND user_id = $3
        RETURNING stored_path
        """,
        fid,
        oid,
        uuid.UUID(user_id),
    )
    if row is not None:
        try:
            Path(row["stored_path"]).unlink(missing_ok=True)
        except OSError:
            pass
