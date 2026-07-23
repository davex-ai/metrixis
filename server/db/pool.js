const { Pool } = require('pg');

// Single shared connection pool for the whole app.
// DATABASE_URL should look like: postgres://user:pass@host:5432/metrixis
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Vercel/hosted Postgres (Neon, Supabase, RDS) usually need SSL.
  // Disable via PGSSL=false in .env for local dev.
  ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  // Errors on idle clients shouldn't crash the process
  console.error('Unexpected Postgres pool error:', err);
});

module.exports = pool;
