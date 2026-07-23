const express = require('express');
const { aggregateDate, yesterdayUTC } = require('../jobs/aggregate');

const router = express.Router();

// Protects this route with a shared secret instead of user auth,
// since it's meant to be called by an external cron pinger, not a browser.
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