# IronNets Server

שרת FastAPI לעיבוד תוכניות עבור אפליקציית IronNets:

- **`POST /extract-pdf`** — חילוץ כתב כמויות (רשתות, מוטות, עמודים) מתוכנית PDF באמצעות Claude API. התוצאה היא **הצעה בלבד** — האפליקציה מציגה אותה לאישור ותיקון לפני שהיא נכנסת להזמנה.
- **`POST /convert-cad`** — המרת DWG/DXF ל-PDF (רינדור המודל). ‏DWG מומר קודם ל-DXF עם `dwg2dxf` של LibreDWG, שמקומפל בתוך ה-Docker image. **בהרצה מקומית על Windows המרת DWG לא זמינה** (DXF כן) — הרץ בקונטיינר.
- **`POST /parse-dxf`** — סיכום קובץ DXF/DWG (שכבות, אורכים, טקסטים) באמצעות ezdxf.
- **`GET /health`** — בדיקת חיים.

## הרצה מומלצת — Docker

ראה [DEPLOY.md](../DEPLOY.md) בשורש הפרויקט (docker compose + Caddy בפרודקשן).

## התקנה

```powershell
cd server
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## מפתח API של Claude

החילוץ מ-PDF דורש חשבון Claude API. הגדר את המפתח לפני ההרצה:

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
```

(אם מחובר דרך `ant auth login`, ה-SDK ימצא את ההרשאות לבד ואין צורך במשתנה.)

## הרצה

```powershell
uvicorn main:app --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` נדרש כדי שהאייפון יוכל לגשת לשרת מהרשת. באפליקציה, בשדה
"כתובת השרת" במסך "הזמנה לפי תוכנית", הזן את כתובת ה-IP של המחשב, למשל
`http://192.168.1.10:8000` (את הכתובת רואים עם `ipconfig`).

שים לב: ייתכן שתצטרך לאשר את פורט 8000 בחומת האש של Windows (רשת פרטית),
או ששני המכשירים יהיו על אותה רשת. בדיקה מהאייפון: פתח בספארי את
`http://<ip>:8000/health` — אמור להחזיר `{"status":"ok"}`.

## בדיקת חילוץ מהטרמינל

```powershell
curl -X POST http://localhost:8000/extract-pdf -F "file=@plan.pdf"
curl -X POST http://localhost:8000/parse-dxf -F "file=@plan.dxf"
```

## עלויות

כל חילוץ שולח את ה-PDF ל-Claude API (מודל `claude-opus-4-8`). העלות תלויה
בגודל התוכנית — בדרך כלל סנטים בודדים עד ~$1 לתוכנית מרובת עמודים.
