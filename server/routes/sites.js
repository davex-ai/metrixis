const express = require('express');
const pool = require('../db/pool');
const { generateTrackingId } = require('../utils/id');

const router = express.Router();

// ── POST /api/sites ── create a new tracked site
router.post('/', async (req, res) => {
  try {
    const { name, domain } = req.body;

    if (!name || !domain) {
      return res.status(400).json({ error: 'Site name and domain are required' });
    }

    const trackingId = generateTrackingId();

    const result = await pool.query(
      `INSERT INTO sites (name, domain, tracking_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, domain, tracking_id, created_at`,
      [name.trim(), domain.trim(), trackingId]
    );

    res.status(201).json({ site: result.rows[0] });
  } catch (err) {
    console.error('Create site error:', err);
    res.status(500).json({ error: 'Could not create site' });
  }
});

// ── GET /api/sites ── list all tracked sites
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, domain, tracking_id, created_at
       FROM sites
       ORDER BY created_at DESC`
    );
    res.json({ sites: result.rows });
  } catch (err) {
    console.error('List sites error:', err);
    res.status(500).json({ error: 'Could not fetch sites' });
  }
});

// ── GET /api/sites/:id ── get one site
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, domain, tracking_id, created_at
       FROM sites WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json({ site: result.rows[0] });
  } catch (err) {
    console.error('Get site error:', err);
    res.status(500).json({ error: 'Could not fetch site' });
  }
});

// ── DELETE /api/sites/:id ── delete a site (and cascade its events/stats)
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM sites WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete site error:', err);
    res.status(500).json({ error: 'Could not delete site' });
  }
});

module.exports = router;
