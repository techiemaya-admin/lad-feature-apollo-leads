const { Pool } = require('pg');
const logger = require('../../core/utils/logger');

/**
 * Shared Database Connection
 * LAD Architecture Compliant - Uses environment variables, no hardcoded paths
 * 
 * Creates database connection pool using environment variables.
 * No dependencies on other feature repos or old folders.
 */
let pool;

try {
  // LAD Architecture: Use environment variables for database configuration
  // Supports standard PostgreSQL environment variables (used by most hosting providers)
  const dbPassword = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || '';
  
  // Only create pool if we have database configuration
  // If password is empty, still create pool (for local dev without password)
  const dbName = process.env.DB_NAME || process.env.POSTGRES_DB || process.env.PGDATABASE;
  
  // LAD Architecture: Database name should be set via environment variable
  // In production, fail if not set. In development, use fallback with warning.
  const isProduction = process.env.NODE_ENV === 'production';
  let effectiveDbName = dbName;
  
  if (!effectiveDbName) {
    if (isProduction) {
      throw new Error('DB_NAME, POSTGRES_DB, or PGDATABASE environment variable must be set in production');
    } else {
      logger.warn('[Apollo Leads DB] Database name not set, using fallback. Set DB_NAME in .env for proper configuration.');
      effectiveDbName = 'lad_dev'; // Development fallback only
    }
  }
  
  const dbConfig = {
    host: process.env.DB_HOST || process.env.POSTGRES_HOST || process.env.PGHOST || 'localhost',
    port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || process.env.PGPORT || '5432', 10),
    database: effectiveDbName,
    user: process.env.DB_USER || process.env.POSTGRES_USER || process.env.PGUSER || 'postgres',
    password: dbPassword, // Can be empty string for local dev
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '2000', 10),
  };

  // Ensure password is a string (not undefined)
  if (dbConfig.password === undefined) {
    dbConfig.password = '';
  }

  pool = new Pool(dbConfig);

  // Test connection (non-blocking)
  pool.query('SELECT NOW()', (err, result) => {
    if (err) {
      logger.warn('[Apollo Leads DB] Database connection test failed (this is OK if DB is not configured)', { 
        error: err.message,
        hint: 'Set DB_PASSWORD, DB_HOST, DB_NAME, DB_USER environment variables to connect to database'
      });
    } else {
      logger.info('[Apollo Leads DB] Database connection pool created successfully', {
        database: dbConfig.database,
        host: dbConfig.host,
        port: dbConfig.port
      });
    }
  });

  // Handle pool errors
  pool.on('error', (err) => {
    logger.error('[Apollo Leads DB] Unexpected database pool error', { error: err.message, stack: err.stack });
  });

} catch (error) {
  logger.warn('[Apollo Leads DB] Failed to create database connection pool (some features may not work)', { 
    error: error.message,
    hint: 'Database is optional for Apollo Leads - API calls will still work without DB connection'
  });
  // Create stub pool that throws errors
  pool = {
    query: async (query, params) => {
      logger.warn('[Apollo Leads DB] Database query attempted but pool not available - database not configured');
      throw new Error(`Database connection not available: ${error.message}. Set DB_PASSWORD, DB_HOST, DB_NAME, DB_USER environment variables.`);
    }
  };
}

module.exports = { pool };
