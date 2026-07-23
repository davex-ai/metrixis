/**
 * Protects routes that require a logged-in dashboard user.
 * Relies on express-session having set req.session.userId at login.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

module.exports = requireAuth;
