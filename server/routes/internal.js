const express = require('express');
const { aggregateDate, yesterdayUTC } = require('../jobs/aggregate');

const router = express.Router();

/**
 * POST /api/internal/aggregate
 *
 * Triggers the daily rollup job over HTTP instead of a Render Cron service
 * (which isn't free). Point a free external scheduler — e.g. cron-job.org —
 * at this endpoint once a day.
 *
 * Protected by a shared secret header, not user auth (there isn't any),
 * since this is meant to be called by a script, not a browser.
 */
router.post('/aggregate', async (req, res) => {
  const secret = req.headers['x-cron-secret'];
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const dateStr = req.query.date || yesterdayUTC();
    await aggregateDate(dateStr);
    res.json({ success: true, date: dateStr });
  } catch (err) {
    console.error('Aggregate endpoint error:', err);
    res.status(500).json({ error: 'Aggregation failed' });
  }
});

module.exports = router;
