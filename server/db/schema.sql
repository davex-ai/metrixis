-- Metrixis database schema
-- Run with: psql $DATABASE_URL -f db/schema.sql

-- ─────────────────────────────────────────────
-- Dashboard users (people who log in to Metrixis)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- Tracked websites, each owned by a user
-- tracking_id is public (embedded in the client-side script)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sites (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  domain       TEXT NOT NULL,
  tracking_id  TEXT NOT NULL UNIQUE, -- e.g. "mtx_ab12cd34..."
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites(user_id);

-- ─────────────────────────────────────────────
-- Raw events — append-only firehose.
-- One row per pageview / click / scroll_depth event.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id            BIGSERIAL PRIMARY KEY,
  site_id       INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN ('pageview', 'click', 'scroll')),

  visitor_id    TEXT NOT NULL,   -- anonymous, persisted client-side (localStorage/cookie)
  session_id    TEXT NOT NULL,   -- resets after 30 min inactivity

  page_url      TEXT NOT NULL,
  referrer      TEXT,

  -- click-specific (populated when event_type = 'click')
  track_label   TEXT,            -- value of data-track="..."

  -- scroll-specific (populated when event_type = 'scroll')
  scroll_depth  SMALLINT,        -- 25 / 50 / 75 / 100

  -- shared metadata, derived server-side from User-Agent / IP
  device_type   TEXT,            -- 'desktop' | 'mobile' | 'tablet'
  browser       TEXT,
  os            TEXT,
  country       TEXT,
  ip_hash       TEXT,            -- salted SHA-256 of client IP, never raw IP

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Query patterns we optimize for: "all events for site X in date range",
-- "all events for site X of type Y in date range"
CREATE INDEX IF NOT EXISTS idx_events_site_created ON events(site_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_site_type_created ON events(site_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_events_visitor ON events(site_id, visitor_id);

-- ─────────────────────────────────────────────
-- Rollup: daily site-wide totals
-- One row per site per day. Rebuilt/updated by the aggregation job.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_stats (
  site_id          INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  pageviews        INTEGER NOT NULL DEFAULT 0,
  unique_visitors  INTEGER NOT NULL DEFAULT 0,
  sessions         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (site_id, date)
);

-- ─────────────────────────────────────────────
-- Rollup: daily stats per page (top pages)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_page_stats (
  site_id          INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  page_url         TEXT NOT NULL,
  pageviews        INTEGER NOT NULL DEFAULT 0,
  unique_visitors  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (site_id, date, page_url)
);

-- ─────────────────────────────────────────────
-- Rollup: daily click stats per tracked element (data-track label)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_click_stats (
  site_id      INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  track_label  TEXT NOT NULL,
  clicks       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (site_id, date, track_label)
);

-- ─────────────────────────────────────────────
-- Rollup: daily scroll depth distribution per site
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_scroll_stats (
  site_id       INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  scroll_depth  SMALLINT NOT NULL, -- 25 / 50 / 75 / 100
  count         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (site_id, date, scroll_depth)
);
