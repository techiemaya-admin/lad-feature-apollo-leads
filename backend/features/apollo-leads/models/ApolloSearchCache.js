/**
 * Apollo Search Cache Model
 * Manages cached Apollo search results for performance optimization
 * LAD Architecture Compliant
 */

const { pool } = require('../../../shared/database/connection');
const { getSchema } = require('../../../core/utils/schemaHelper');
const logger = require('../../../core/utils/logger');

class ApolloSearchCache {
  /**
   * Create or update search cache
   * LAD Architecture: Uses tenant_id, dynamic schema, metadata, is_deleted
   */
  static async upsert({ searchKey, results, tenantId, userId }, req = null) {
    try {
      const schema = getSchema(req);

      const result = await pool.query(`
        INSERT INTO ${schema}.apollo_search_cache (
          search_key,
          results,
          tenant_id, -- Changed from organization_id
          user_id,
          hit_count,
          last_accessed_at,
          metadata, -- New field
          is_deleted -- New field
        ) VALUES ($1, $2, $3, $4, 1, CURRENT_TIMESTAMP, $5, $6)
        ON CONFLICT (search_key, tenant_id) -- Tenant-scoped ON CONFLICT
        DO UPDATE SET
          results = EXCLUDED.results,
          hit_count = ${schema}.apollo_search_cache.hit_count + 1,
          last_accessed_at = CURRENT_TIMESTAMP,
          metadata = EXCLUDED.metadata, -- Update metadata
          is_deleted = EXCLUDED.is_deleted, -- Update is_deleted
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        searchKey,
        JSON.stringify(results),
        tenantId, // Use tenantId
        userId,
        JSON.stringify({}), // Default metadata
        false // Default is_deleted
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('[Apollo Search Cache] Error upserting search cache', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get cached search results
   * LAD Architecture: Uses tenant_id, dynamic schema
   */
  static async findByKey(searchKey, tenantId, req = null) {
    try {
      const schema = getSchema(req);

      const result = await pool.query(`
        SELECT * FROM ${schema}.apollo_search_cache
        WHERE search_key = $1 
          AND tenant_id = $2
          AND is_deleted = false
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
      `, [searchKey, tenantId]);

      if (result.rows[0]) {
        // Update access stats
        await pool.query(`
          UPDATE ${schema}.apollo_search_cache
          SET 
            hit_count = hit_count + 1,
            last_accessed_at = CURRENT_TIMESTAMP
          WHERE search_key = $1 AND tenant_id = $2
        `, [searchKey, tenantId]);
      }

      return result.rows[0] || null;
    } catch (error) {
      logger.error('[Apollo Search Cache] Error finding cached search', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Clear old cache entries
   * LAD Architecture: Uses dynamic schema
   */
  static async pruneOldEntries(hoursOld = 24, req = null) {
    try {
      const schema = getSchema(req);

      const result = await pool.query(`
        DELETE FROM ${schema}.apollo_search_cache
        WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '${hoursOld} hours'
        RETURNING id
      `, []);

      return result.rowCount;
    } catch (error) {
      logger.error('[Apollo Search Cache] Error pruning search cache', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get cache statistics
   * LAD Architecture: Uses tenant_id, dynamic schema
   */
  static async getStats(tenantId = null, req = null) {
    try {
      const schema = getSchema(req);
      let sql = `
        SELECT 
          COUNT(*) as total_entries,
          SUM(hit_count) as total_hits,
          AVG(hit_count) as avg_hits_per_entry,
          MAX(last_accessed_at) as most_recent_access
        FROM ${schema}.apollo_search_cache
        WHERE is_deleted = false
      `;
      const params = [];

      if (tenantId) {
        sql += ` AND tenant_id = $1`;
        params.push(tenantId);
      }

      const result = await pool.query(sql, params);
      return result.rows[0];
    } catch (error) {
      logger.error('[Apollo Search Cache] Error getting cache stats', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

module.exports = ApolloSearchCache;
