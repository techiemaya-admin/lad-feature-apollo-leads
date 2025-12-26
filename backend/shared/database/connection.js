
/**
 * Shared Database Connection
 * References the database from sts-service or campaigns
 */
let pool;

try {
  // Try to import from sts-service first
  const postgresConfig = require('../../../../sts-service/src/config/postgres');
  pool = postgresConfig.pool;
  console.log('[Apollo Leads DB] ✅ Database connection loaded from sts-service');
} catch (error1) {
  try {
    // Fallback to campaigns shared connection
    const campaignsDb = require('../../../../lad-feature-campaigns/shared/database/connection');
    pool = campaignsDb.pool;
    console.log('[Apollo Leads DB] ✅ Database connection loaded from campaigns');
  } catch (error2) {
    console.error('[Apollo Leads DB] ❌ Failed to load database connection:', error2.message);
    // Create stub pool
    pool = {
      query: async (query, params) => {
        console.error('[Apollo Leads DB] ❌ Database query attempted but pool not available!');
        throw new Error(`Database connection not available: ${error2.message}`);
      }
    };
  }
}

module.exports = { pool };
