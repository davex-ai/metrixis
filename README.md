# Metrixis

A self-hosted, minimal Google Analytics alternative — pageviews, clicks, and scroll depth, rolled up into daily/monthly stats.

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

## 2. Backend (Render)

1. Push `server/` to a GitHub repo (or the whole `metrixis/` repo — Render can be pointed at a subdirectory).
2. In Render, create from `server/render.yaml` (Blueprint), or manually create:
   - A **Web Service**: build `npm install`, start `node index.js`
   - A **Cron Job**: same build, start `node jobs/aggregate.js`, schedule `10 0 * * *` (00:10 UTC daily)
3. Set env vars on both (copy from `server/.env.example`):
   - `DATABASE_URL` — Supabase connection string
   - `SESSION_SECRET` — long random string (Render can auto-generate this for the web service)
   - `DASHBOARD_URL` — your Vercel frontend URL, e.g. `https://metrixis.vercel.app`
   - `PGSSL=true`
   - `NODE_ENV=production`

## 3. Frontend (Vercel)

1. Push `client/` (or point Vercel at the subdirectory).
2. Set env var:
   - `VITE_API_URL` — your Render backend URL, e.g. `https://metrixis-api.onrender.com`
3. Deploy.

## 4. Try it

1. Visit your Vercel URL, sign up.
2. Add a site — you'll get an embed snippet like:
   ```html
   <script src="https://metrixis-api.onrender.com/tracker.js" data-site="mtx_xxxx" defer></script>
   ```
3. Paste it into any test page's `<head>`.
4. Add `data-track="some_label"` to any button/link you want click stats on.
5. Visit the test page a few times — pageviews show up live (queried straight from
   raw events for "today"). Click/page/scroll rollups won't populate until the daily
   cron job runs — or trigger it manually for today for a quick check:
   ```
   node jobs/aggregate.js 2026-07-22
   ```

## Local dev

**Backend:**
```
cd server
cp .env.example .env   # fill in DATABASE_URL, SESSION_SECRET
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

- No geo-IP — `country` column exists but is never populated
- `ip_hash` is stored per event but not yet used for bot/dedup filtering
- No rate limiting on `/api/collect` beyond a 50-event batch cap
- Free-tier Render web services spin down after 15 min idle (cold start delay on next request)
