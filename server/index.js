require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const sitesRoutes = require('./routes/sites');
const collectRoutes = require('./routes/collect');
const statsRoutes = require('./routes/stats');
const internalRoutes = require('./routes/internal');

const app = express();

// ── Core middleware ──
app.use(express.json());

// No auth, no cookies — CORS can be a plain allow-list without credentials.
app.use(
  cors({
    origin: process.env.DASHBOARD_URL || 'http://localhost:5173',
  })
);

// ── Routes ──
app.use('/api/sites', sitesRoutes);
app.use('/api/collect', collectRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/internal', internalRoutes);

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
