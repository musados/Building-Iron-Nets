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
import shutil
import subprocess
import tempfile
from pathlib import Path

import anthropic
import ezdxf
from ezdxf import recover
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

app = FastAPI(title="IronNets Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_PDF_BYTES = 32 * 1024 * 1024  # Claude API request limit

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
                "required": ["name", "lengthM", "widthM"],
                "properties": {
                    "name": {"type": "string"},
                    "lengthM": {"type": "number"},
                    "widthM": {"type": "number"},
                },
            },
        },
        "bars": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["diameterMm", "lengthM", "quantity"],
                "properties": {
                    "diameterMm": {"type": "number"},
                    "lengthM": {"type": "number"},
                    "quantity": {"type": "integer"},
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
                },
            },
        },
        "notes": {"type": "string"},
    },
}

EXTRACTION_PROMPT = """\
אתה מהנדס כמויות. לפניך תוכנית קונסטרוקציה (שרטוט בניין). חלץ ממנה כתב כמויות \
לזיון ברזל, כהצעה שתיבדק על ידי אדם:

1. meshes — שטחים מלבניים שמכוסים ברשתות ברזל מרותכות (תקרות, רצפות, קירות). \
לכל שטח: שם קצר בעברית, אורך ורוחב במטרים. אם שטח אינו מלבני, פרק אותו למלבנים.
2. bars — מוטות ברזל בודדים המופיעים בתוכנית (קורות, זיון נוסף): קוטר במ"מ, \
אורך במטרים, כמות.
3. columns — עמודים: שם/סימון, כמות עמודים זהים, מידות חתך בס"מ (רוחב/עומק), \
גובה במטרים, מספר מוטות אורכיים וקוטרם במ"מ, קוטר חישוקים במ"מ ומרווח חישוקים בס"מ. \
העזר בתוכניות החתך אם קיימות.
4. notes — הערות חשובות בעברית: אי-ודאויות, נתונים חסרים, הנחות שהנחת, \
וקנה מידה אם זוהה.

כללים:
- אל תמציא נתונים. אם מידה לא ברורה — אל תכלול את הפריט, וציין זאת ב-notes.
- שים לב לסימונים מקובלים בישראל: Ø או ⌀ לקוטר, @ למרווח, ס"מ/מ'.
- אם התוכנית אינה תוכנית קונסטרוקציה, החזר רשימות ריקות והסבר ב-notes.
"""


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/extract-pdf")
async def extract_pdf(file: UploadFile) -> dict:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="קובץ ריק")
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="קובץ גדול מדי (מעל 32MB)")
    if not data.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="הקובץ אינו PDF תקין")

    try:
        client = anthropic.Anthropic()
    except anthropic.AnthropicError as exc:
        raise HTTPException(
            status_code=502,
            detail="מפתח ה-API של Claude לא מוגדר בשרת (ANTHROPIC_API_KEY)",
        ) from exc

    try:
        response = client.messages.create(
            model="claude-opus-4-8",
            max_tokens=16000,
            thinking={"type": "adaptive"},
            output_config={
                "format": {"type": "json_schema", "schema": EXTRACTION_SCHEMA}
            },
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": "application/pdf",
                                "data": base64.b64encode(data).decode(),
                            },
                        },
                        {"type": "text", "text": EXTRACTION_PROMPT},
                    ],
                }
            ],
        )
    except anthropic.AuthenticationError as exc:
        raise HTTPException(
            status_code=502,
            detail="מפתח ה-API של Claude חסר או שגוי בצד השרת",
        ) from exc
    except anthropic.RateLimitError as exc:
        raise HTTPException(
            status_code=502, detail="חריגה ממכסת הקריאות — נסה שוב בעוד רגע"
        ) from exc
    except anthropic.APIStatusError as exc:
        raise HTTPException(
            status_code=502, detail=f"שגיאת Claude API: {exc.message}"
        ) from exc
    except anthropic.APIConnectionError as exc:
        raise HTTPException(
            status_code=502, detail="אין חיבור ל-Claude API מהשרת"
        ) from exc
    except TypeError as exc:
        # The SDK raises TypeError when no credential source is configured
        raise HTTPException(
            status_code=502,
            detail="מפתח ה-API של Claude לא מוגדר בשרת (ANTHROPIC_API_KEY)",
        ) from exc

    if response.stop_reason == "refusal":
        raise HTTPException(
            status_code=422, detail="המודל סירב לעבד את הקובץ הזה"
        )
    if response.stop_reason == "max_tokens":
        raise HTTPException(
            status_code=422,
            detail="התוכנית מורכבת מדי לעיבוד בבקשה אחת — נסה לפצל את ה-PDF",
        )

    text = next(
        (block.text for block in response.content if block.type == "text"), None
    )
    if text is None:
        raise HTTPException(status_code=502, detail="תשובת המודל ריקה")
    return json.loads(text)


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
