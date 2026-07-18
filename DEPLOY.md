# פריסה (Deployment)

שני קונטיינרים, HTTP פשוט, מאחורי Caddy שמטפל ב-TLS:

```
npx expo export  ←  Dockerfile.web  ←  קונטיינר web (Caddy סטטי, פורט 8080)
server/          ←  Dockerfile      ←  קונטיינר server (FastAPI, פורט 8000)
```

## הרצה

```bash
cp .env.example .env     # ומלא את ANTHROPIC_API_KEY (נדרש לחילוץ AI בלבד)
docker compose up --build -d
```

‏docker compose קורא את `.env` אוטומטית. הקובץ ב-.gitignore ולא נכנס ל-git.

- ווב: http://localhost:8080
- ‏API: ‏http://localhost:8000 (בדיקה: `/health`)

## Caddy בפרודקשן

הקונטיינרים לא מטפלים ב-TLS — ה-Caddy הראשי שלך עושה reverse proxy אליהם.

### אפשרות א' — שני סאב-דומיינים

```caddyfile
app.example.com {
	reverse_proxy localhost:8080
}

api.example.com {
	reverse_proxy localhost:8000
}
```

באפליקציה (מובייל/ווב), כתובת השרת: `https://api.example.com`.

### אפשרות ב' — דומיין אחד עם נתיב /api

```caddyfile
example.com {
	handle_path /api/* {
		reverse_proxy localhost:8000
	}
	handle {
		reverse_proxy localhost:8080
	}
}
```

באפליקציה, כתובת השרת: `https://example.com/api`
(`handle_path` מסיר את הקידומת, כך שהשרת מקבל `/extract-pdf` וכו' כרגיל).

אם ה-Caddy רץ באותו docker network כמו הקונטיינרים, אפשר לפנות אליהם בשמות
השירותים (`web:80`, `server:8000`) במקום `localhost`.

## הערות

- **המרת DWG** עובדת רק בקונטיינר (דורשת `dwg2dxf` מ-LibreDWG שמותקן ב-image).
  בהרצה מקומית על Windows בלי Docker, שרת ה-DWG יחזיר שגיאה מסודרת שמסבירה זאת.
- **גודל העלאות**: תוכניות גדולות — ודא של-Caddy אין מגבלת `request_body`
  נמוכה מדי (ברירת המחדל בסדר; ה-API של Claude מוגבל ל-32MB לקובץ PDF).
- **עדכון גרסה**: ‏`git pull && docker compose up --build -d`.
