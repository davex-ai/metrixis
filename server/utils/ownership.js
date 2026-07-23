const pool = require('../db/pool');

/**
 * Verifies the given siteId belongs to the given userId.
 * Returns the site row if valid, or null if not found / not owned.
 *
 * Every stats route must call this before querying events/rollups,
 * otherwise a logged-in user could read another user's site data
 * just by guessing a site ID in the URL.
 */
async function getOwnedSite(siteId, userId) {
  const result = await pool.query(
    'SELECT id, name, domain, tracking_id FROM sites WHERE id = $1 AND user_id = $2',
    [siteId, userId]
  );
  return result.rows[0] || null;
}

module.exports = { getOwnedSite };
