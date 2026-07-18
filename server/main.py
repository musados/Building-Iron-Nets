"""IronNets processing server.

FastAPI server providing plan-file processing for the IronNets app:
- /extract-pdf: AI quantity takeoff from a PDF construction plan (Claude API)
- /parse-dxf:   geometry/text summary of a DXF plan (ezdxf)
- /health:      liveness check

Run: uvicorn main:app --host 0.0.0.0 --port 8000
Requires ANTHROPIC_API_KEY in the environment (or an `ant auth login` profile).
"""

import base64
import json
import tempfile
from pathlib import Path

import anthropic
import ezdxf
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

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


@app.post("/parse-dxf")
async def parse_dxf(file: UploadFile) -> dict:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="קובץ ריק")

    with tempfile.NamedTemporaryFile(suffix=".dxf", delete=False) as tmp:
        tmp.write(data)
        tmp_path = Path(tmp.name)

    try:
        try:
            doc = ezdxf.readfile(tmp_path)
        except (IOError, ezdxf.DXFStructureError) as exc:
            raise HTTPException(
                status_code=400,
                detail="הקובץ אינו DXF תקין. קובצי DWG יש לייצא ל-DXF קודם.",
            ) from exc

        unit_factor = _UNIT_TO_M.get(doc.header.get("$INSUNITS", 0), 1.0)
        layers: dict[str, dict] = {}
        texts: list[str] = []

        for entity in doc.modelspace():
            layer = entity.dxf.layer
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
    finally:
        tmp_path.unlink(missing_ok=True)
