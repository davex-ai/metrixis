# Metrixis

A self-hosted, minimal Google Analytics alternative — pageviews, clicks, and scroll depth, rolled up into daily/monthly stats.

**No authentication.** Anyone with the dashboard URL can view and manage all sites. Fine for a private/personal tool; don't share the URL publicly.

## Structure

```
metrixis/
├── server/     Express API + Postgres schema + tracking script + aggregation job
└── client/     React dashboard (Vite)
```

## 1. Database (Supabase)

1. Create a Supabase project, grab the Postgres connection string.
2. Run the schema against it:
   ```
   psql "<your-connection-string>" -f server/db/schema.sql
   ```
   (If migrating an existing DB that still has the old `users` table, run
   `server/db/migrate_remove_auth.sql` instead/first.)

## 2. Backend (Render)

1. Push `server/` to a GitHub repo.
2. Create a Render **Web Service**: build `npm install`, start `node index.js`.
   (`server/render.yaml` has this as a Blueprint if you prefer.)
3. Set env vars (copy from `server/.env.example`):
   - `DATABASE_URL` — Supabase connection string
   - `CRON_SECRET` — long random string (protects the aggregation trigger endpoint)
   - `DASHBOARD_URL` — your Vercel frontend URL, e.g. `https://metrixis.vercel.app`
   - `PGSSL=true`
   - `NODE_ENV=production`

### Daily aggregation (free, no Render Cron)

Render Cron Jobs always cost something. Instead, the app exposes
`POST /api/internal/aggregate` (guarded by `CRON_SECRET`), and you trigger it
with a **free** external scheduler:

1. Sign up at [cron-job.org](https://cron-job.org) (or similar).
2. Create a daily job (e.g. 00:10 UTC) that sends:
   - `POST https://<your-render-url>/api/internal/aggregate`
   - Header: `x-cron-secret: <your CRON_SECRET value>`

## 3. Frontend (Vercel)

1. Push `client/` (or point Vercel at the `client` subdirectory).
2. Set env var:
   - `VITE_API_URL` — your Render backend URL, e.g. `https://metrixis-api.onrender.com`
3. `client/vercel.json` is already set up to rewrite all routes to `index.html`
   so React Router's client-side routes (e.g. `/sites/new`) work on refresh.
4. Deploy.

## 4. Try it

1. Visit your Vercel URL — no login needed, straight to the dashboard.
2. Add a site — you'll get an embed snippet like:
   ```html
   <script src="https://metrixis-api.onrender.com/tracker.js" data-site="mtx_xxxx" defer></script>
   ```
3. Paste it into any test page's `<head>`.
4. Add `data-track="some_label"` to any button/link you want click stats on.
5. Visit the test page a few times — pageviews show up live (queried straight from
   raw events for "today"). Click/page/scroll rollups won't populate until the
   aggregation job runs for that day — trigger it manually to check sooner:
   ```
   curl -X POST https://<your-render-url>/api/internal/aggregate \
     -H "x-cron-secret: <your CRON_SECRET>" \
     -G -d date=2026-07-23
   ```

## Local dev

**Backend:**
```
cd server
cp .env.example .env   # fill in DATABASE_URL, CRON_SECRET
npm install
node index.js          # http://localhost:4000
```

**Frontend:**
```
cd client
cp .env.example .env   # VITE_API_URL=http://localhost:4000
npm install
npm run dev             # http://localhost:5173
```

## Known gaps (v1 scope)

- No authentication — dashboard is open to anyone with the URL
- No geo-IP — `country` column exists but is never populated
- `ip_hash` is stored per event but not yet used for bot/dedup filtering
- No rate limiting on `/api/collect` beyond a 50-event batch cap
- Free-tier Render web services spin down after 15 min idle (cold start delay on next request)
