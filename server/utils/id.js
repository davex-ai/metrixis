const crypto = require('crypto');

/**
 * Generates a public tracking ID for a site, e.g. "mtx_3f9a1c2b8e7d4a6f"
 * Safe to embed in client-side JS — it's an identifier, not a secret.
 */
function generateTrackingId() {
  return 'mtx_' + crypto.randomBytes(12).toString('hex');
}

module.exports = { generateTrackingId };
