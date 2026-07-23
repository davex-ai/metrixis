const express = require('express');
const pool = require('../db/pool');
const requireAuth = require('../middleware/requireAuth');
const { getOwnedSite } = require('../utils/ownership');

const router = express.Router();

router.use(requireAuth);

// Accepts ?range=7d | 30d | 90d | month  — defaults to 30d
function resolveDateRange(range) {
  const days = { '7d': 7, '30d': 30, '90d': 90, month: 30 }[range] || 30;
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  return start.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Middleware-style helper: confirms :siteId belongs to the logged-in user
 * before letting a route handler run. Attaches the site to req.site.
 */
async function loadOwnedSite(req, res, next) {
  try {
    const site = await getOwnedSite(req.params.siteId, req.session.userId);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    req.site = site;
    next();
  } catch (err) {
    console.error('Load site error:', err);
    res.status(500).json({ error: 'Could not verify site' });
  }
}

router.use('/:siteId', loadOwnedSite);

// ── GET /api/stats/:siteId/overview?range=30d ──
// Daily pageviews/visitors/sessions for charting, plus totals.
router.get('/:siteId/overview', async (req, res) => {
  try {
    const startDate = resolveDateRange(req.query.range);

    const daily = await pool.query(
      `SELECT date, pageviews, unique_visitors, sessions
       FROM daily_stats
       WHERE site_id = $1 AND date >= $2
       ORDER BY date ASC`,
      [req.site.id, startDate]
    );

    // "Today" isn't in daily_stats yet (aggregation runs for past days only),
    // so compute it live from raw events and append it.
    const today = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE event_type = 'pageview') AS pageviews,
         COUNT(DISTINCT visitor_id) AS unique_visitors,
         COUNT(DISTINCT session_id) AS sessions
       FROM events
       WHERE site_id = $1 AND created_at >= CURRENT_DATE`,
      [req.site.id]
    );

    const todayRow = today.rows[0];
    const series = [...daily.rows];
    if (Number(todayRow.pageviews) > 0 || Number(todayRow.unique_visitors) > 0) {
      series.push({
        date: new Date().toISOString().slice(0, 10),
        pageviews: Number(todayRow.pageviews),
        unique_visitors: Number(todayRow.unique_visitors),
        sessions: Number(todayRow.sessions),
      });
    }

    const totals = series.reduce(
      (acc, row) => ({
        pageviews: acc.pageviews + Number(row.pageviews),
        unique_visitors: acc.unique_visitors + Number(row.unique_visitors),
        sessions: acc.sessions + Number(row.sessions),
      }),
      { pageviews: 0, unique_visitors: 0, sessions: 0 }
    );

    res.json({ series, totals });
  } catch (err) {
    console.error('Overview stats error:', err);
    res.status(500).json({ error: 'Could not fetch overview stats' });
  }
});

// ── GET /api/stats/:siteId/pages?range=30d ──
// Top pages by pageviews within the range.
router.get('/:siteId/pages', async (req, res) => {
  try {
    const startDate = resolveDateRange(req.query.range);

    const result = await pool.query(
      `SELECT page_url, SUM(pageviews) AS pageviews, SUM(unique_visitors) AS unique_visitors
       FROM daily_page_stats
       WHERE site_id = $1 AND date >= $2
       GROUP BY page_url
       ORDER BY pageviews DESC
       LIMIT 20`,
      [req.site.id, startDate]
    );

    res.json({ pages: result.rows });
  } catch (err) {
    console.error('Top pages stats error:', err);
    res.status(500).json({ error: 'Could not fetch page stats' });
  }
});

// ── GET /api/stats/:siteId/clicks?range=30d ──
// Click counts per tracked element (data-track label) within the range.
router.get('/:siteId/clicks', async (req, res) => {
  try {
    const startDate = resolveDateRange(req.query.range);

    const result = await pool.query(
      `SELECT track_label, SUM(clicks) AS clicks
       FROM daily_click_stats
       WHERE site_id = $1 AND date >= $2
       GROUP BY track_label
       ORDER BY clicks DESC
       LIMIT 20`,
      [req.site.id, startDate]
    );

    res.json({ clicks: result.rows });
  } catch (err) {
    console.error('Click stats error:', err);
    res.status(500).json({ error: 'Could not fetch click stats' });
  }
});

// ── GET /api/stats/:siteId/scroll?range=30d ──
// Scroll depth distribution (how many pageviews reached 25/50/75/100%).
router.get('/:siteId/scroll', async (req, res) => {
  try {
    const startDate = resolveDateRange(req.query.range);

    const result = await pool.query(
      `SELECT scroll_depth, SUM(count) AS count
       FROM daily_scroll_stats
       WHERE site_id = $1 AND date >= $2
       GROUP BY scroll_depth
       ORDER BY scroll_depth ASC`,
      [req.site.id, startDate]
    );

    res.json({ scroll: result.rows });
  } catch (err) {
    console.error('Scroll stats error:', err);
    res.status(500).json({ error: 'Could not fetch scroll stats' });
  }
});

module.exports = router;
