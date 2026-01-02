/**
 * Real Database Connection
 * Connects to PostgreSQL database using environment variables
 */

const { Pool } = require('pg');

// Create PostgreSQL pool
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  max: parseInt(process.env.POSTGRES_MAX_CLIENTS || '10'),
  idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: 5000,
});

// Log connection
pool.on('connect', () => {
  console.log('[DB] Connected to PostgreSQL:', process.env.POSTGRES_HOST);
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
});

// Export both pool and query function
module.exports = {
  pool,
  query: (text, params) => pool.query(text, params)
};
