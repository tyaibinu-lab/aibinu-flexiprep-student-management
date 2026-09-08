# AUTH_VARS.md

Required environment variables for the authentication routes

- AUTH_SECRET — HMAC-SHA256 secret for signing session tokens (strong random string)
- AIRTABLE_API_KEY — Airtable API key with access to the Auth_Users table
- AIRTABLE_BASE_ID — ID of the Airtable base containing Auth_Users
- AIRTABLE_TABLE_NAME — (optional) defaults to Auth_Users
- COOKIE_NAME — (optional) cookie name, defaults to aibinu_sess
- SESSION_TTL_SECONDS — (optional) session lifetime in seconds (default 604800 = 7 days)
- MAX_FAILED_LOGIN — (optional) number of failed attempts before lockout (default 5)
- LOCKOUT_SECONDS — (optional) lockout duration in seconds (default 900 = 15 minutes)

Deployment notes

- Add these as repository secrets in GitHub and as environment variables in Vercel.
- For local testing, create a .env.local with these values (do not commit).
- Ensure AUTH_SECRET is long and random (32+ chars). Use a secure generator.

Airtable table schema (Auth_Users)

- auth_id: text (unique identifier for auth record)
- email: text
- username: text
- password_hash: text (bcrypt hash)
- role: single select (student|teacher|reviewer|admin)
- status: single select (active|suspended|pending)
- failed_login_count: number
- locked_until: text (ISO datetime)
- last_login_at: text (ISO datetime)

Testing checklist (CP-61–66)

1. Create test user record in Airtable with known bcrypt password hash.
2. POST /api/auth/login with identifier and password — expect 200, Set-Cookie header, and user object.
3. GET /api/auth/me with cookie — expect 200 and user object.
4. POST /api/auth/logout — expect 200 and cookie cleared; subsequent /api/auth/me → 401.
5. Attempt wrong password repeatedly to trigger lockout — expect 401 until locked, then 403 when locked.

Security notes

- Do not send password hashes to the client or logs.
- Keep AIRTABLE_API_KEY and AUTH_SECRET secret and rotate periodically.
