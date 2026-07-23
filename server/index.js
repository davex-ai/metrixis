require('dotenv').config();

const express = require('express');
const session = require('express-session');
const cors = require('cors');

const path = require('path');
const authRoutes = require('./routes/auth');
const sitesRoutes = require('./routes/sites');
const collectRoutes = require('./routes/collect');
const statsRoutes = require('./routes/stats');

const app = express();

// ── Core middleware ──
app.use(express.json());

app.use(
  cors({
    origin: process.env.DASHBOARD_URL || 'http://localhost:5173',
    credentials: true, // required so the session cookie is sent cross-origin
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // requires HTTPS in prod
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

// ── Routes ──
app.use('/api/auth', authRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/collect', collectRoutes);
app.use('/api/stats', statsRoutes);

// Public tracking script — served with a long cache lifetime is tempting,
// but keep it short for now so updates to tracker.js reach sites quickly.
app.get('/tracker.js', (req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.set('Cache-Control', 'public, max-age=300'); // 5 min
  res.sendFile(path.join(__dirname, 'tracker', 'tracker.js'));
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ── Fallback error handler ──
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Metrixis API listening on port ${PORT}`);
});
