#!/bin/bash
# רץ פעם אחת באתחול הראשון של קונטיינר ה-Postgres (docker-entrypoint-initdb.d).
# יוצר שתי סכמות מבודדות עם משתמש נפרד לכל אחת:
#   auth    — משתמשים ו-refresh tokens (שירות ה-auth בלבד)
#   content — הזמנות וקבצי תוכניות (שרת העיבוד בלבד)
# לכל role יש בעלות רק על הסכמה שלו, כך שגם אם אחד השירותים נפרץ —
# אין לו גישה לנתוני הסכמה השנייה.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	CREATE ROLE ironnets_auth LOGIN PASSWORD '${AUTH_DB_PASSWORD}';
	CREATE ROLE ironnets_content LOGIN PASSWORD '${CONTENT_DB_PASSWORD}';

	REVOKE ALL ON DATABASE ${POSTGRES_DB} FROM PUBLIC;
	REVOKE ALL ON SCHEMA public FROM PUBLIC;
	GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO ironnets_auth, ironnets_content;

	CREATE SCHEMA auth AUTHORIZATION ironnets_auth;
	CREATE SCHEMA content AUTHORIZATION ironnets_content;

	ALTER ROLE ironnets_auth SET search_path = auth;
	ALTER ROLE ironnets_content SET search_path = content;
EOSQL
