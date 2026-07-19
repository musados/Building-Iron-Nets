# פריסה (Deployment)

ארבעה קונטיינרים, HTTP פשוט, מאחורי Caddy שמטפל ב-TLS:

```
npx expo export  ←  Dockerfile.web  ←  קונטיינר web (Caddy סטטי, פורט 8080)
server/          ←  Dockerfile      ←  קונטיינר server (FastAPI, פורט 8000)
auth-server/     ←  Dockerfile      ←  קונטיינר auth (FastAPI, פורט 8100)
postgres:16      ←  סכמות auth + content, משתמש DB נפרד לכל שירות
```

הפרדת האבטחה: שירות ה-auth מחזיק את המשתמשים, ה-refresh tokens ומפתח
החתימה; שרת התוכן מחזיק הזמנות וקבצים ומאמת טוקנים רק מול המפתח הציבורי
(`/.well-known/jwks.json`). לכל שירות משתמש Postgres משלו שרואה רק את
הסכמה שלו.

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
	# שירות ה-auth — התחברות ומפתח ציבורי
	handle /auth/* {
		reverse_proxy localhost:8100
	}
	handle /.well-known/jwks.json {
		reverse_proxy localhost:8100
	}
	# כל השאר — שרת העיבוד וההזמנות
	handle {
		reverse_proxy localhost:8000
	}
}
```

באפליקציה (מובייל/ווב), כתובת השרת: `https://api.example.com`.
מאחר ששני השירותים תחת אותו דומיין, אין צורך למלא "כתובת שרת התחברות"
נפרדת במסך ההתחברות.

### אפשרות ב' — דומיין אחד עם נתיב /api

```caddyfile
example.com {
	handle /api/auth/* {
		uri strip_prefix /api
		reverse_proxy localhost:8100
	}
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

## חשבונות והתחברות (Google / Apple)

1. מלא ב-`.env` את סיסמאות ה-DB ואת פרטי הספקים (ראה `.env.example`).
2. **Google**: צור OAuth client IDs ב-Google Cloud Console (Web + iOS +
   Android לפי הצורך) ומלא את `GOOGLE_CLIENT_IDS`, `GOOGLE_WEB_CLIENT_ID`
   ו-`GOOGLE_WEB_CLIENT_SECRET`. באפליקציה מלא את אותם IDs ב-`app.json`
   תחת `extra.googleAuth`. ל-redirect בווב הוסף ב-Google Console את
   `https://app.example.com/sign-in`.
3. **Apple**: הפעל "Sign in with Apple" ל-bundle ID ב-Apple Developer
   ומלא את `APPLE_BUNDLE_IDS`. (חנות Apple דורשת להציע Apple לצד Google.)
4. מפתח החתימה של הטוקנים נוצר אוטומטית בהרצה הראשונה ונשמר ב-volume
   ‏`authdata` — אל תמחק אותו (מחיקתו תנתק את כל המשתמשים).
5. קבצי תוכניות שהועלו נשמרים ב-volume ‏`planfiles`.

באפליקציה: כפתור החשבון במסך הראשי ← התחברות. בשמירת הזמנה עם קבצי
תוכנית, ברירת המחדל היא "תוצאה בלבד" (הקבצים נשארים במכשיר) עם אזהרה;
אפשר לבחור להעלות גם את הקבצים.

## הערות

- **המרת DWG** עובדת רק בקונטיינר (דורשת `dwg2dxf` מ-LibreDWG שמותקן ב-image).
  בהרצה מקומית על Windows בלי Docker, שרת ה-DWG יחזיר שגיאה מסודרת שמסבירה זאת.
- **גודל העלאות**: תוכניות גדולות — ודא של-Caddy אין מגבלת `request_body`
  נמוכה מדי (ברירת המחדל בסדר; ה-API של Claude מוגבל ל-32MB לקובץ PDF).
- **עדכון גרסה**: ‏`git pull && docker compose up --build -d`.
