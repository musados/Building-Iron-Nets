"""IronNets processing server.

FastAPI server providing plan-file processing for the IronNets app:
- /extract-pdf: AI quantity takeoff from a PDF construction plan (Claude API)
- /parse-dxf:   geometry/text summary of a DXF plan (ezdxf)
- /health:      liveness check

Run: uvicorn main:app --host 0.0.0.0 --port 8000
Requires ANTHROPIC_API_KEY in the environment (or an `ant auth login` profile).
"""

import base64
import io
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import anthropic
import ezdxf
from dotenv import load_dotenv
from ezdxf import recover
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

# בהרצה מקומית: טוען .env מתיקיית השרת או משורש הפרויקט.
# בקונטיינר המשתנים מגיעים מ-docker compose ולא נדרס דבר.
load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env")

app = FastAPI(title="IronNets Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_PDF_BYTES = 32 * 1024 * 1024  # Claude API request limit

DEFAULT_MODEL = "claude-opus-4-8"
FABLE_MODEL = "claude-fable-5"


def _selected_model() -> str:
    return os.environ.get("CLAUDE_MODEL", "").strip() or DEFAULT_MODEL

# Matches ExtractionResult in the app (src/api/serverApi.ts)
EXTRACTION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["meshes", "bars", "columns", "notes"],
    "properties": {
        "meshes": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "name",
                    "lengthM",
                    "widthM",
                    "wireDiameterMm",
                    "spacingCm",
                    "derivation",
                ],
                "properties": {
                    "name": {"type": "string"},
                    "lengthM": {"type": "number"},
                    "widthM": {"type": "number"},
                    "wireDiameterMm": {"type": "number"},
                    "spacingCm": {"type": "number"},
                    "derivation": {"type": "string"},
                },
            },
        },
        "bars": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["diameterMm", "lengthM", "quantity", "derivation"],
                "properties": {
                    "diameterMm": {"type": "number"},
                    "lengthM": {"type": "number"},
                    "quantity": {"type": "integer"},
                    "derivation": {"type": "string"},
                },
            },
        },
        "columns": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "name",
                    "count",
                    "widthCm",
                    "depthCm",
                    "heightM",
                    "longBarCount",
                    "longBarDiameterMm",
                    "stirrupDiameterMm",
                    "stirrupSpacingCm",
                    "derivation",
                ],
                "properties": {
                    "name": {"type": "string"},
                    "count": {"type": "integer"},
                    "widthCm": {"type": "number"},
                    "depthCm": {"type": "number"},
                    "heightM": {"type": "number"},
                    "longBarCount": {"type": "integer"},
                    "longBarDiameterMm": {"type": "number"},
                    "stirrupDiameterMm": {"type": "number"},
                    "stirrupSpacingCm": {"type": "number"},
                    "derivation": {"type": "string"},
                },
            },
        },
        "notes": {"type": "string"},
    },
}

EXTRACTION_PROMPT = """\
אתה מהנדס כמויות. לפניך תוכנית קונסטרוקציה (שרטוט בניין) — ייתכן שמצורפים \
כמה קבצים: תוכנית קומה, תוכניות חתך של עמודים/קורות, פרטים וכו'. לכל גיליון \
מוצגת תמונה כללית ולאחריה הגדלות של רבעי הגיליון, כדי שתוכל לקרוא גם טקסטים \
קטנים. הצלב מידע בין הקבצים — למשל זיון עמודים מתוכניות החתך מול מיקומם \
בתוכנית הקומה. חלץ כתב כמויות לזיון ברזל, כהצעה שתיבדק על ידי אדם:

1. meshes — שטחים המכוסים ברשתות ברזל מרותכות (תקרות, רצפות, קירות). שים לב:
   - אזורי רשת מסומנים בדרך כלל כשטחים מקווקווים/מוצללים, או בהערה כללית \
("רשת Ø8@20 בכל התקרה") — במקרה כזה השטח הוא כל שטח האלמנט.
   - מדוד מידות מקווי המידות (בס"מ בדרך כלל) ומרשת הצירים של התוכנית.
   - שטח לא מלבני (צורת L, מצולע) — פרק למלבנים, שורה לכל מלבן.
   - לכל רשת מלא גם wireDiameterMm (קוטר החוט במ"מ) ו-spacingCm (מרווח \
העיניים בס"מ) לפי הכיתוב — למשל Φ8@20/20 ← קוטר 8, מרווח 20. אם המפרט \
אינו קריא, רשום 0 בשני השדות והאפליקציה תשתמש בברירת המחדל.
   - אם לאלמנט רשת עליונה (ב.ע/ר.ע) ורשת תחתונה (ב.ת/ר.ת) עם מפרטים שונים — \
החזר שתי שורות לאותו שטח, אחת לכל שכבה, וציין בשם "עליונה"/"תחתונה".
   - אם המידה מוערכת ולא מפורשת — כלול את השטח בכל זאת, וציין ב-notes שמדובר \
בהערכה ולפי מה הערכת. עדיף שטח מוערך ומסומן מאשר השמטה שקטה.
2. bars — מוטות ברזל בודדים (קורות, זיון נוסף): קוטר במ"מ, אורך במטרים, כמות.
3. columns — עמודים: שם/סימון, כמות עמודים זהים, מידות חתך בס"מ (רוחב/עומק), \
גובה במטרים, מספר מוטות אורכיים וקוטרם במ"מ, קוטר חישוקים במ"מ ומרווח חישוקים \
בס"מ. העזר בתוכניות החתך אם קיימות.
4. notes — הערות חשובות בעברית: אי-ודאויות, הנחות והערכות שביצעת, נתונים \
חסרים, וקנה מידה אם זוהה.

לכל פריט (רשת, מוט, עמוד) מלא גם שדה derivation: הסבר קצר וקריא בעברית איך \
הגעת למספרים — מאיזה כיתוב או אזור בתוכנית הפריט נלקח, איך נמדדו או חושבו \
המידות והכמות (למשל "נמדד מקווי המידות בין צירים 5–7"), ואילו הנחות הנחת. \
ההסבר מיועד למשתמש שרוצה לוודא את החישוב מול התוכנית.

כללים:
- נהל את החשיבה שלך בעברית — סיכום החשיבה מוצג למשתמש כחיווי התקדמות חי.
- מוטות ועמודים: אל תמציא נתונים — אם מספר לא קריא, אל תכלול וציין ב-notes.
- רשתות: מותר להעריך מידות מקנה המידה וקווי המידות, בתנאי שההנחה מתועדת ב-notes.
- סימונים מקובלים בישראל: Ø או ⌀ לקוטר, @ למרווח, מידות בס"מ, ב.ע = ברזל עליון, \
ב.ת = ברזל תחתון.
- אם התוכנית אינה תוכנית קונסטרוקציה, החזר רשימות ריקות והסבר ב-notes.
"""


MAX_EXTRACT_PAGES = 4  # תקציב עמודים כולל לכל הקבצים בבקשה אחת
IMAGE_MAX_EDGE = 2500  # רזולוציית התמונות הנשלחות למודל
TILE_GRID = 2  # חלוקת כל עמוד ל-2×2 רבעים מוגדלים
TILE_OVERLAP = 0.06  # חפיפה בין רבעים כדי לא לחתוך כיתובים בתפר

_TILE_NAMES = {
    (0, 0): "רבע שמאלי-עליון",
    (0, 1): "רבע ימני-עליון",
    (1, 0): "רבע שמאלי-תחתון",
    (1, 1): "רבע ימני-תחתון",
}


def _image_block(png_bytes: bytes) -> dict:
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": "image/png",
            "data": base64.b64encode(png_bytes).decode(),
        },
    }


def _pdf_to_content_blocks(
    data: bytes, file_label: str, max_pages: int
) -> tuple[list, int]:
    """מרנדר את עמודי ה-PDF לתמונה כללית + רבעים מוגדלים, ומצרף את שכבת
    הטקסט אם קיימת. גיליונות CAD גדולים אינם קריאים כתמונה אחת."""
    import fitz  # pymupdf

    pdf = fitz.open(stream=data, filetype="pdf")
    blocks: list = []
    page_count = len(pdf)

    for page_index in range(min(page_count, max_pages)):
        page = pdf[page_index]
        rect = page.rect
        long_edge = max(rect.width, rect.height)

        blocks.append(
            {
                "type": "text",
                "text": f"{file_label}, עמוד {page_index + 1} — תמונה כללית:",
            }
        )
        overview_scale = IMAGE_MAX_EDGE / long_edge
        pix = page.get_pixmap(matrix=fitz.Matrix(overview_scale, overview_scale))
        blocks.append(_image_block(pix.tobytes("png")))

        tile_scale = overview_scale * TILE_GRID
        tile_w = rect.width / TILE_GRID
        tile_h = rect.height / TILE_GRID
        margin_x = tile_w * TILE_OVERLAP
        margin_y = tile_h * TILE_OVERLAP
        for row in range(TILE_GRID):
            for col in range(TILE_GRID):
                clip = fitz.Rect(
                    max(rect.x0, rect.x0 + col * tile_w - margin_x),
                    max(rect.y0, rect.y0 + row * tile_h - margin_y),
                    min(rect.x1, rect.x0 + (col + 1) * tile_w + margin_x),
                    min(rect.y1, rect.y0 + (row + 1) * tile_h + margin_y),
                )
                pix = page.get_pixmap(
                    matrix=fitz.Matrix(tile_scale, tile_scale), clip=clip
                )
                blocks.append(
                    {
                        "type": "text",
                        "text": f"{file_label}, עמוד {page_index + 1} — הגדלה, "
                        f"{_TILE_NAMES[(row, col)]}:",
                    }
                )
                blocks.append(_image_block(pix.tobytes("png")))

        text = page.get_text().strip()
        if text:
            blocks.append(
                {
                    "type": "text",
                    "text": f"שכבת הטקסט של {file_label}, עמוד {page_index + 1} "
                    f"(כפי שחולצה מה-PDF):\n{text[:20000]}",
                }
            )

    return blocks, page_count


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/extract-pdf")
async def extract_pdf(
    files: list[UploadFile] = File(default=[]),
    file: UploadFile | None = File(default=None),
):
    """חילוץ כמויות ממספר קובצי תוכנית (תוכנית קומה + תוכניות חתך וכו').
    השדה file נשמר לתאימות לאחור עם קליינטים ששולחים קובץ בודד."""
    uploads = list(files)
    if file is not None:
        uploads.append(file)
    if not uploads:
        raise HTTPException(status_code=400, detail="לא צורף קובץ")

    documents: list[tuple[str, bytes]] = []
    total_bytes = 0
    for upload in uploads:
        data = await upload.read()
        if not data:
            raise HTTPException(status_code=400, detail="קובץ ריק")
        if not data.startswith(b"%PDF"):
            raise HTTPException(
                status_code=400,
                detail=f"הקובץ {upload.filename or ''} אינו PDF תקין",
            )
        total_bytes += len(data)
        documents.append((upload.filename or f"קובץ {len(documents) + 1}", data))
    if total_bytes > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=413, detail="הקבצים גדולים מדי (מעל 32MB יחד)"
        )

    try:
        client = anthropic.Anthropic()
    except anthropic.AnthropicError as exc:
        raise HTTPException(
            status_code=502,
            detail="מפתח ה-API של Claude לא מוגדר בשרת (ANTHROPIC_API_KEY)",
        ) from exc

    content_blocks: list = []
    pages_budget = MAX_EXTRACT_PAGES
    skipped_pages = 0
    for index, (name, data) in enumerate(documents):
        label = f'קובץ {index + 1} ("{name}")'
        if pages_budget <= 0:
            skipped_pages += 1
            continue
        try:
            file_blocks, page_count = _pdf_to_content_blocks(
                data, label, pages_budget
            )
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"עיבוד הקובץ {name} נכשל — ודא שהקובץ תקין",
            ) from exc
        content_blocks.extend(file_blocks)
        rendered = min(page_count, pages_budget)
        skipped_pages += page_count - rendered
        pages_budget -= rendered
    if skipped_pages > 0:
        content_blocks.append(
            {
                "type": "text",
                "text": f"שים לב: {skipped_pages} עמודים לא נשלחו בגלל מגבלת "
                f"עמודים ({MAX_EXTRACT_PAGES}) — ציין זאת ב-notes.",
            }
        )
    content_blocks.append({"type": "text", "text": EXTRACTION_PROMPT})

    model = _selected_model()
    request_kwargs = dict(
        model=model,
        max_tokens=16000,
        # display=summarized מזרים סיכום קריא של החשיבה — משמש כחיווי התקדמות חי
        thinking={"type": "adaptive", "display": "summarized"},
        output_config={
            "format": {"type": "json_schema", "schema": EXTRACTION_SCHEMA}
        },
        messages=[{"role": "user", "content": content_blocks}],
    )

    def ndjson(obj: dict) -> str:
        return json.dumps(obj, ensure_ascii=False) + "\n"

    def event_stream():
        yield ndjson(
            {"type": "progress", "text": "התוכנית נשלחה למודל, מתחיל ניתוח…\n\n"}
        )
        try:
            if model == FABLE_MODEL:
                # מסווגי הבטיחות של Fable עשויים לסרב לבקשות תמימות —
                # fallback צד-שרת מריץ את אותה בקשה על Opus באותו round-trip
                stream_cm = client.beta.messages.stream(
                    **request_kwargs,
                    betas=["server-side-fallback-2026-06-01"],
                    fallbacks=[{"model": DEFAULT_MODEL}],
                )
            else:
                stream_cm = client.messages.stream(**request_kwargs)
            with stream_cm as stream:
                for event in stream:
                    if (
                        event.type == "content_block_delta"
                        and getattr(event.delta, "type", "") == "thinking_delta"
                    ):
                        chunk = getattr(event.delta, "thinking", "")
                        if chunk:
                            yield ndjson({"type": "progress", "text": chunk})
                response = stream.get_final_message()
        except anthropic.AuthenticationError:
            yield ndjson(
                {
                    "type": "error",
                    "detail": "מפתח ה-API של Claude חסר או שגוי בצד השרת",
                }
            )
            return
        except anthropic.RateLimitError:
            yield ndjson(
                {
                    "type": "error",
                    "detail": "חריגה ממכסת הקריאות — נסה שוב בעוד רגע",
                }
            )
            return
        except anthropic.APIStatusError as exc:
            yield ndjson(
                {"type": "error", "detail": f"שגיאת Claude API: {exc.message}"}
            )
            return
        except anthropic.APIConnectionError:
            yield ndjson(
                {"type": "error", "detail": "אין חיבור ל-Claude API מהשרת"}
            )
            return
        except TypeError:
            # The SDK raises TypeError when no credential source is configured
            yield ndjson(
                {
                    "type": "error",
                    "detail": "מפתח ה-API של Claude לא מוגדר בשרת (ANTHROPIC_API_KEY)",
                }
            )
            return

        if response.stop_reason == "refusal":
            yield ndjson(
                {"type": "error", "detail": "המודל סירב לעבד את הקובץ הזה"}
            )
            return
        if response.stop_reason == "max_tokens":
            yield ndjson(
                {
                    "type": "error",
                    "detail": "התוכנית מורכבת מדי לעיבוד בבקשה אחת — נסה לפצל את ה-PDF",
                }
            )
            return

        text = next(
            (block.text for block in response.content if block.type == "text"),
            None,
        )
        if text is None:
            yield ndjson({"type": "error", "detail": "תשובת המודל ריקה"})
            return
        yield ndjson({"type": "result", "data": json.loads(text)})

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


def _entity_length(entity) -> float:
    """Best-effort length of a DXF entity in drawing units."""
    try:
        kind = entity.dxftype()
        if kind == "LINE":
            return (entity.dxf.end - entity.dxf.start).magnitude
        if kind == "LWPOLYLINE":
            points = list(entity.get_points("xy"))
            total = sum(
                (
                    (points[i + 1][0] - points[i][0]) ** 2
                    + (points[i + 1][1] - points[i][1]) ** 2
                )
                ** 0.5
                for i in range(len(points) - 1)
            )
            if entity.closed and len(points) > 1:
                total += (
                    (points[0][0] - points[-1][0]) ** 2
                    + (points[0][1] - points[-1][1]) ** 2
                ) ** 0.5
            return total
        if kind == "CIRCLE":
            return 6.283185307 * entity.dxf.radius
        if kind == "ARC":
            import math

            sweep = (entity.dxf.end_angle - entity.dxf.start_angle) % 360
            return math.radians(sweep) * entity.dxf.radius
    except Exception:
        pass
    return 0.0


# $INSUNITS → factor converting drawing units to meters
_UNIT_TO_M = {1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1.0}


def _is_dwg(data: bytes) -> bool:
    """DWG files start with a version string like AC1032."""
    return data[:2] == b"AC"


def _convert_dwg_to_dxf(dwg_path: Path, workdir: Path) -> Path:
    """Convert DWG to DXF using LibreDWG's dwg2dxf (installed in the Docker image)."""
    if shutil.which("dwg2dxf") is None:
        raise HTTPException(
            status_code=501,
            detail=(
                "המרת DWG דורשת את הכלי dwg2dxf (LibreDWG), שמותקן בגרסת "
                "ה-Docker של השרת. הרץ את השרת בקונטיינר, או ייצא ל-DXF/PDF."
            ),
        )
    out_path = workdir / (dwg_path.stem + ".dxf")
    result = subprocess.run(
        ["dwg2dxf", "-o", str(out_path), str(dwg_path)],
        capture_output=True,
        timeout=120,
    )
    if result.returncode != 0 or not out_path.exists():
        raise HTTPException(
            status_code=400,
            detail=(
                "המרת ה-DWG נכשלה — ייתכן שהקובץ פגום או בגרסה לא נתמכת. "
                "נסה לייצא ל-DXF או PDF."
            ),
        )
    return out_path


def _fix_zero_handles(dxf_path: Path) -> None:
    """LibreDWG לפעמים כותב handle 0 לישויות — מקצה להן handles חדשים."""
    lines = dxf_path.read_text(errors="surrogateescape").splitlines()
    max_handle = 0
    for i in range(len(lines) - 1):
        if lines[i].strip() in ("5", "105"):
            try:
                max_handle = max(max_handle, int(lines[i + 1].strip(), 16))
            except ValueError:
                pass
    next_handle = max_handle + 1
    changed = False
    for i in range(len(lines) - 1):
        if lines[i].strip() in ("5", "105") and lines[i + 1].strip() == "0":
            lines[i + 1] = f"{next_handle:X}"
            next_handle += 1
            changed = True
    if changed:
        dxf_path.write_text("\n".join(lines) + "\n", errors="surrogateescape")


def _read_cad_document(data: bytes, workdir: Path):
    """Load an uploaded DWG or DXF into an ezdxf document."""
    if _is_dwg(data):
        dwg_path = workdir / "input.dwg"
        dwg_path.write_bytes(data)
        dxf_path = _convert_dwg_to_dxf(dwg_path, workdir)
    else:
        dxf_path = workdir / "input.dxf"
        dxf_path.write_bytes(data)
    try:
        return ezdxf.readfile(dxf_path)
    except (IOError, ezdxf.DXFStructureError, ValueError):
        # קבצים שהומרו (למשל ע"י LibreDWG) לא תמיד עוברים טעינה קפדנית —
        # מתקנים handles שבורים וטוענים במצב recover הסלחני
        try:
            _fix_zero_handles(dxf_path)
            doc, _auditor = recover.readfile(dxf_path)
            return doc
        except (IOError, ezdxf.DXFStructureError, ValueError) as exc:
            raise HTTPException(
                status_code=400,
                detail="הקובץ אינו DXF או DWG תקין",
            ) from exc


def _modelspace_entities(doc) -> list:
    """ישויות ה-modelspace, כולל fallback לקבצים מומרים שבהם ה-Layout
    מצביע על block record שגוי אך הישויות קיימות ב-*Model_Space."""
    entities = list(doc.modelspace())
    if entities:
        return entities
    try:
        block_record = doc.block_records.get("*Model_Space")
    except Exception:
        return []
    return list(block_record.entity_space)


@app.post("/convert-cad")
async def convert_cad(file: UploadFile) -> Response:
    """Convert a DWG/DXF plan to a PDF rendering of its modelspace."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="קובץ ריק")

    import matplotlib

    matplotlib.use("agg")
    import matplotlib.pyplot as plt
    from ezdxf.addons import Importer
    from ezdxf.addons.drawing import RenderContext, Frontend
    from ezdxf.addons.drawing.matplotlib import MatplotlibBackend

    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        doc = _read_cad_document(data, workdir)

        entities = _modelspace_entities(doc)
        if not entities:
            raise HTTPException(
                status_code=422, detail="לא נמצאו ישויות לשרטוט בקובץ"
            )

        # מייבאים את הישויות למסמך חדש ותקין — קבצים מומרים מגיעים לעיתים
        # עם Layouts שבורים שמפילים את הרינדור הישיר
        clean = ezdxf.new()
        importer = Importer(doc, clean)
        importer.import_entities(entities, clean.modelspace())
        importer.finalize()

        fig = plt.figure(figsize=(16.5, 11.7))  # A3 landscape
        ax = fig.add_axes([0, 0, 1, 1])
        ctx = RenderContext(clean)
        Frontend(ctx, MatplotlibBackend(ax)).draw_layout(
            clean.modelspace(), finalize=True
        )

        buf = io.BytesIO()
        try:
            fig.savefig(buf, format="pdf", dpi=300)
        finally:
            plt.close(fig)

    return Response(
        content=buf.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="plan.pdf"'},
    )


@app.post("/parse-dxf")
async def parse_dxf(file: UploadFile) -> dict:
    """Summarize a DXF or DWG plan (DWG is converted automatically)."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="קובץ ריק")

    with tempfile.TemporaryDirectory() as tmp:
        doc = _read_cad_document(data, Path(tmp))

        unit_factor = _UNIT_TO_M.get(doc.header.get("$INSUNITS", 0), 1.0)
        layers: dict[str, dict] = {}
        texts: list[str] = []

        for entity in _modelspace_entities(doc):
            layer = entity.dxf.layer or "0"
            info = layers.setdefault(
                layer, {"name": layer, "entityCount": 0, "totalLengthM": 0.0}
            )
            info["entityCount"] += 1
            info["totalLengthM"] += _entity_length(entity) * unit_factor

            kind = entity.dxftype()
            if kind == "TEXT":
                texts.append(entity.dxf.text)
            elif kind == "MTEXT":
                texts.append(entity.plain_text())

        for info in layers.values():
            info["totalLengthM"] = round(info["totalLengthM"], 2)

        return {
            "layers": sorted(layers.values(), key=lambda x: -x["entityCount"]),
            "texts": [t for t in texts if t.strip()][:500],
        }
