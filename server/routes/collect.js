const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');
const { parseUserAgent } = require('../utils/userAgent');

const router = express.Router();

const VALID_EVENT_TYPES = new Set(['pageview', 'click', 'scroll']);
const VALID_SCROLL_DEPTHS = new Set([25, 50, 75, 100]);

// In-memory cache of tracking_id -> site_id, so we don't hit Postgres
// on every single event just to resolve which site it belongs to.
// Simple TTL-less cache is fine here: tracking IDs never change once created.
const siteIdCache = new Map();

async function resolveSiteId(trackingId) {
  if (siteIdCache.has(trackingId)) {
    return siteIdCache.get(trackingId);
  }
  const result = await pool.query('SELECT id FROM sites WHERE tracking_id = $1', [trackingId]);
  if (result.rows.length === 0) {
    return null;
  }
  const siteId = result.rows[0].id;
  siteIdCache.set(trackingId, siteId);
  return siteId;
}

/**
 * Hashes the client IP for privacy. We never store raw IPs.
 * Salted with SESSION_SECRET so hashes aren't reversible via rainbow tables,
 * and aren't comparable across deployments with a different secret.
 */
function hashIp(ip) {
  return crypto
    .createHash('sha256')
    .update(ip + process.env.SESSION_SECRET)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Core ingest logic, isolated from the route handler so it's easy to
 * swap this for a queue-backed writer later without touching HTTP code.
 */
async function ingestEvent({ siteId, event, ip }) {
  const { deviceType, browser, os } = parseUserAgent(event.userAgent);

  const scrollDepth =
    event.type === 'scroll' && VALID_SCROLL_DEPTHS.has(event.scrollDepth) ? event.scrollDepth : null;

  const ipHash = ip && ip !== 'unknown' ? hashIp(ip) : null;

  await pool.query(
    `INSERT INTO events
      (site_id, event_type, visitor_id, session_id, page_url, referrer,
       track_label, scroll_depth, device_type, browser, os, country, ip_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      siteId,
      event.type,
      event.visitorId,
      event.sessionId,
      event.pageUrl,
      event.referrer || null,
      event.type === 'click' ? event.trackLabel || null : null,
      scrollDepth,
      deviceType,
      browser,
      os,
      null, // country — no geo-IP lookup yet, see note in project notes
      ipHash,
    ]
  );
}

// ── POST /api/collect ──
// Public endpoint. No auth — identified by tracking_id in the payload.
// Accepts a single event OR a batch: { trackingId, events: [...] }
router.post('/', async (req, res) => {
  try {
    const { trackingId, events } = req.body;

    if (!trackingId || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'trackingId and a non-empty events array are required' });
    }

    // Cap batch size to prevent abuse
    if (events.length > 50) {
      return res.status(400).json({ error: 'Too many events in one batch (max 50)' });
    }

    const siteId = await resolveSiteId(trackingId);
    if (!siteId) {
      // Unknown tracking ID — fail quietly with 202 so the client script
      // never throws visible errors on the tracked website.
      return res.status(202).json({ accepted: false });
    }

    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

    for (const event of events) {
      if (!VALID_EVENT_TYPES.has(event.type)) continue;
      if (!event.visitorId || !event.sessionId || !event.pageUrl) continue;

      await ingestEvent({ siteId, event: { ...event, userAgent: req.headers['user-agent'] }, ip });
    }

    res.status(202).json({ accepted: true });
  } catch (err) {
    console.error('Collect error:', err);
    // Still return 202 — never let ingest errors surface to the tracked site
    res.status(202).json({ accepted: false });
  }
});

module.exports = router;
