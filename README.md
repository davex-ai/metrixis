# Metrixis

Self-hosted analytics, scoped by account → sites → events. Your own Google Analytics.

## Architecture

```
metrixis/
├── auth-service/   Node + Express + trustlyx — signup/login/refresh, issues JWTs
├── backend/        Python + FastAPI + PostgreSQL — sites, ingestion, analytics queries
├── tracker/        TypeScript — the <script> snippet embedded on tracked sites
└── dashboard/      React + TypeScript + Tailwind — the UI customers see
```

**Why two backends?** `trustlyx` (the auth SDK, **v3.2.4**) is a Node/Express/MongoDB library,
so authentication runs as its own small service. It issues JWTs (HS256, via `jsonwebtoken`)
using a shared secret. The Python backend independently verifies those tokens using the
same secret — no network call between the two services on every request, just a
shared `JWT_SECRET` in both `.env` files. This cross-language handoff has been
tested with a real token: signed by `trustlyx`'s `JWTService`, decoded successfully
by `python-jose` using the same secret.

## Auth flow

Register → verify email → login. No magic links.

1. `POST /auth/signup` (auth-service) — creates the user, emails a verification link shaped `${APP_URL}/verify-email/:token`
2. Dashboard's `/verify-email/:token` page calls `POST /auth/verify-email` on mount
3. `POST /auth/login` — fails with `"Verify your email"` until step 2 is done
4. Access/refresh tokens issued; access token verified independently by the Python backend

## Analytics endpoints

- `GET /sites/{id}/analytics/overview?range=24h|7d|30d|90d` — pageviews, unique visitors, sessions, bounce rate, avg session duration, avg scroll depth, top pages/referrers/clicks, device breakdown, pageviews-over-time
- `GET /sites/{id}/analytics/realtime` — visitors active in the last 5 minutes, their current page, and pageviews in the last 5 minutes (dashboard polls this every 15s)

```
Browser (customer's site)          Dashboard (React)
        │                                  │
        │ tracking events                  │ login/signup
        │ (public, tracking_key only)      │ (JWT)
        ▼                                  ▼
┌───────────────┐                  ┌───────────────┐
│ Python backend│◄─────JWT────────►│  auth-service │
│ (FastAPI)     │  (verify only,   │ (Node/Express/│
│ + PostgreSQL  │   shared secret) │  trustlyx)    │
│               │                  │ + MongoDB     │
└───────────────┘                  └───────────────┘
```

## Data model

- **Account** = a `trustlyx` user (Mongo, in auth-service).
- **Site** = a tracked project/website, owned by an account (`owner_id` = JWT `id` claim). Has a public `tracking_key` embedded in the snippet, and a `tracked_events` toggle map (pageviews/clicks/scroll/custom on or off).
- **Event** = a single interaction: `pageview`, `click`, `scroll`, or `custom`, tied to an anonymous `visitor_id` (persisted in localStorage) and `session_id` (persisted in sessionStorage, 30-min idle timeout). No PII is collected.

One account can own many sites; the dashboard's site switcher scopes every query.

## Running locally

You'll need Postgres, MongoDB, and Redis running locally (or point the `.env` files at hosted instances).

### 1. Auth service
```bash
cd auth-service
cp .env.example .env   # fill in JWT_SECRET, REFRESH_SECRET, MONGO_URI, REDIS_URL
npm install
npm run dev             # listens on :4000
```

### 2. Python backend
```bash
cd backend
cp .env.example .env    # JWT_SECRET must match auth-service's exactly
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python init_db.py       # creates tables
uvicorn app.main:app --reload --port 8000
```

### 3. Dashboard
```bash
cd dashboard
cp .env.example .env
npm install
npm run dev              # listens on :5173
```

### 4. Tracker (build once, host the output)
```bash
cd tracker
npm install
npm run build             # outputs dist/index.global.js — this is what CDN-hosted tracker.js should be
```

## Embedding the tracker on a customer site

After creating a site in the dashboard, copy the generated snippet:

```html
<script src="https://cdn.metrixis.io/tracker.js" data-tracking-key="mtx_xxxxxxxx"></script>
```

This auto-tracks pageviews, clicks (on `button`, `a`, and anything with
`data-mtx-track`), and scroll depth at 25/50/75/100% thresholds. Events are
buffered client-side and flushed every 5s (or sooner at 20 events, or
immediately on tab close via `navigator.sendBeacon`).

For custom events:
```js
window.metrixis.track("signup_completed", { plan: "pro" });
```

## Debugging email sending

`auth-service` logs every send attempt (`[auth-service:email] >>> sending...` / `<<< sent OK` or `<<< FAILED: <reason>`), so check that terminal first.

To isolate Gmail SMTP from the rest of the app entirely:
```bash
cd auth-service
node test-email.js you@example.com
```
This bypasses trustlyx, Mongo, and Redis — if it fails, the problem is Gmail credentials (App Password, 2FA not enabled, etc.), not the app. If it succeeds but signup emails still don't arrive, check spam, and check the `[auth-service:email]` log lines during a real signup for the actual error.

## Security notes

- The `tracking_key` is public by design (same trust model as GA's measurement ID / Plausible's site ID) — abuse mitigation is batch-size limits and per-site event-type toggles, not secrecy.
- `/sites/*` and `/sites/*/analytics/*` require a valid JWT and are scoped to `owner_id`; a site owned by another account 404s rather than 403s, so IDs can't be enumerated.
- `/api/ingest` is mounted as an isolated FastAPI sub-app with an open (but credential-less) CORS policy, since it's called from arbitrary customer origins — the main dashboard API keeps a locked-down CORS policy separately.
