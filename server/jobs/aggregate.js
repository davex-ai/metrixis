const pool = require('../db/pool');

/**
 * Rolls up raw `events` rows into the daily_* aggregate tables for a given
 * date (defaults to yesterday, since "today" is still incomplete).
 *
 * Idempotent: every INSERT uses ON CONFLICT DO UPDATE, so re-running this
 * for the same date is always safe — useful if the job fails partway
 * through, or you need to backfill/recompute a specific day.
 *
 * Usage:
 *   node jobs/aggregate.js                 -> aggregates yesterday (UTC)
 *   node jobs/aggregate.js 2026-07-20       -> aggregates a specific date
 */

async function aggregateDate(dateStr) {
  console.log(`[aggregate] Rolling up events for ${dateStr}...`);

  // All four rollups run inside one transaction: either the whole day's
  // aggregates land together, or none do — keeps the dashboard from ever
  // showing partially-updated stats for a day.
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── daily_stats: pageviews, unique visitors, sessions per site ──
    await client.query(
      `INSERT INTO daily_stats (site_id, date, pageviews, unique_visitors, sessions)
       SELECT
         site_id,
         $1::date AS date,
         COUNT(*) FILTER (WHERE event_type = 'pageview') AS pageviews,
         COUNT(DISTINCT visitor_id) AS unique_visitors,
         COUNT(DISTINCT session_id) AS sessions
       FROM events
       WHERE created_at >= $1::date AND created_at < ($1::date + INTERVAL '1 day')
       GROUP BY site_id
       ON CONFLICT (site_id, date) DO UPDATE SET
         pageviews = EXCLUDED.pageviews,
         unique_visitors = EXCLUDED.unique_visitors,
         sessions = EXCLUDED.sessions`,
      [dateStr]
    );

    // ── daily_page_stats: pageviews per page per site ──
    await client.query(
      `INSERT INTO daily_page_stats (site_id, date, page_url, pageviews, unique_visitors)
       SELECT
         site_id,
         $1::date AS date,
         page_url,
         COUNT(*) AS pageviews,
         COUNT(DISTINCT visitor_id) AS unique_visitors
       FROM events
       WHERE event_type = 'pageview'
         AND created_at >= $1::date AND created_at < ($1::date + INTERVAL '1 day')
       GROUP BY site_id, page_url
       ON CONFLICT (site_id, date, page_url) DO UPDATE SET
         pageviews = EXCLUDED.pageviews,
         unique_visitors = EXCLUDED.unique_visitors`,
      [dateStr]
    );

    // ── daily_click_stats: clicks per tracked element per site ──
    await client.query(
      `INSERT INTO daily_click_stats (site_id, date, track_label, clicks)
       SELECT
         site_id,
         $1::date AS date,
         track_label,
         COUNT(*) AS clicks
       FROM events
       WHERE event_type = 'click'
         AND track_label IS NOT NULL
         AND created_at >= $1::date AND created_at < ($1::date + INTERVAL '1 day')
       GROUP BY site_id, track_label
       ON CONFLICT (site_id, date, track_label) DO UPDATE SET
         clicks = EXCLUDED.clicks`,
      [dateStr]
    );

    // ── daily_scroll_stats: scroll depth distribution per site ──
    await client.query(
      `INSERT INTO daily_scroll_stats (site_id, date, scroll_depth, count)
       SELECT
         site_id,
         $1::date AS date,
         scroll_depth,
         COUNT(*) AS count
       FROM events
       WHERE event_type = 'scroll'
         AND scroll_depth IS NOT NULL
         AND created_at >= $1::date AND created_at < ($1::date + INTERVAL '1 day')
       GROUP BY site_id, scroll_depth
       ON CONFLICT (site_id, date, scroll_depth) DO UPDATE SET
         count = EXCLUDED.count`,
      [dateStr]
    );

    await client.query('COMMIT');
    console.log(`[aggregate] Done for ${dateStr}.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[aggregate] Failed for ${dateStr}:`, err);
    throw err;
  } finally {
    client.release();
  }
}

function yesterdayUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Allow running directly: `node jobs/aggregate.js [YYYY-MM-DD]`
if (require.main === module) {
  const dateArg = process.argv[2] || yesterdayUTC();
  aggregateDate(dateArg)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { aggregateDate, yesterdayUTC };
