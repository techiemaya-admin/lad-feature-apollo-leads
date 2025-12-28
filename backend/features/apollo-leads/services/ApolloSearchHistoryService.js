/**
 * Apollo Search History Service
 * LAD Architecture Compliant - Tenant-scoped search history
 * 
 * Handles search history operations with proper tenant isolation.
 */

const { pool } = require('../../../shared/database/connection');
const { getSchema } = require('../../../core/utils/schemaHelper');
const { requireTenantId } = require('../../../core/utils/tenantHelper');
const { SEARCH_HISTORY_CONFIG } = require('../../../core/config/constants');
const logger = require('../../../core/utils/logger');

class ApolloSearchHistoryService {
  /**
   * Save search history
   * LAD Architecture: Requires tenant context and uses dynamic schema
   * 
   * @param {Object} searchData - Search data to save
   * @param {Object} req - Express request object (for tenant context)
   */
  async saveSearchHistory(searchData, req = null) {
    try {
      // LAD Architecture: Require tenant context
      const tenantId = requireTenantId(
        searchData.tenantId,
        req,
        'saveSearchHistory'
      );
      const schema = getSchema(req);

      const query = `
        INSERT INTO ${schema}.apollo_search_history 
          (tenant_id, user_id, search_params, results_count, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id
      `;
      
      await pool.query(query, [
        tenantId,
        searchData.userId,
        JSON.stringify(searchData.searchParams),
        searchData.results
      ]);
      
      logger.debug('[Apollo Search History] Search history saved', {
        userId: searchData.userId,
        resultsCount: searchData.results
      });
    } catch (error) {
      logger.error('[Apollo Search History] Save search history error', { 
        error: error.message, 
        stack: error.stack 
      });
      // Don't throw - this is not critical
    }
  }

  /**
   * Get search history
   * LAD Architecture: Tenant-scoped query with dynamic schema
   * 
   * @param {string} userId - User ID
   * @param {Object} options - Query options (limit, page)
   * @param {Object} req - Express request object (for tenant context)
   * @returns {Promise<Array>} Search history records
   */
  async getSearchHistory(userId, options = {}, req = null) {
    const { 
      limit = SEARCH_HISTORY_CONFIG.DEFAULT_LIMIT, 
      page = SEARCH_HISTORY_CONFIG.DEFAULT_PAGE 
    } = options;
    const offset = (page - 1) * limit;

    try {
      // LAD Architecture: Require tenant context
      const tenantId = requireTenantId(null, req, 'getSearchHistory');
      const schema = getSchema(req);
      
      const query = `
        SELECT id, search_params, results_count, created_at
        FROM ${schema}.apollo_search_history
        WHERE tenant_id = $1 AND user_id = $2
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `;
      
      const result = await pool.query(query, [tenantId, userId, limit, offset]);
      
      return result.rows.map(row => ({
        ...row,
        search_params: JSON.parse(row.search_params)
      }));
    } catch (error) {
      logger.error('[Apollo Search History] Get search history error', { 
        error: error.message, 
        stack: error.stack 
      });
      return [];
    }
  }

  /**
   * Delete search history
   * LAD Architecture: Tenant-scoped deletion with dynamic schema
   * 
   * @param {string} historyId - History record ID
   * @param {string} userId - User ID
   * @param {Object} req - Express request object (for tenant context)
   */
  async deleteSearchHistory(historyId, userId, req = null) {
    try {
      // LAD Architecture: Require tenant context
      const tenantId = requireTenantId(null, req, 'deleteSearchHistory');
      const schema = getSchema(req);
      
      const query = `
        DELETE FROM ${schema}.apollo_search_history
        WHERE tenant_id = $1 AND id = $2 AND user_id = $3
      `;
      
      const result = await pool.query(query, [tenantId, historyId, userId]);
      
      if (result.rowCount === 0) {
        throw new Error('Search history record not found or access denied');
      }
      
      logger.debug('[Apollo Search History] Search history deleted', {
        historyId,
        userId
      });
    } catch (error) {
      logger.error('[Apollo Search History] Delete search history error', { 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }
}

module.exports = new ApolloSearchHistoryService();

