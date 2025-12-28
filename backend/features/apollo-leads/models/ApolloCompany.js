/**
 * Apollo Company Model
 * Manages Apollo company data and enrichment
 * LAD Architecture Compliant
 */

const { pool } = require('../../../shared/database/connection');
const { getSchema } = require('../../../core/utils/schemaHelper');
const logger = require('../../../core/utils/logger');

class ApolloCompany {
  /**
   * Save or update company data
   * LAD Architecture: Uses tenant_id, dynamic schema, metadata, is_deleted
   */
  static async upsert(companyData, req = null) {
    try {
      const {
        apolloId,
        name,
        domain,
        industry,
        employeeCount,
        revenue,
        location,
        phone,
        website,
        enrichedData,
        tenantId, // Changed from organizationId
        userId,
        metadata = {},
        is_deleted = false
      } = companyData;

      const schema = getSchema(req);

      const result = await pool.query(`
        INSERT INTO ${schema}.apollo_companies (
          apollo_id,
          name,
          domain,
          industry,
          employee_count,
          revenue,
          location,
          phone,
          website,
          enriched_data,
          tenant_id, -- Changed from organization_id
          user_id,
          metadata, -- New field
          is_deleted -- New field
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (apollo_id, tenant_id) -- Tenant-scoped ON CONFLICT
        DO UPDATE SET
          name = EXCLUDED.name,
          domain = EXCLUDED.domain,
          industry = EXCLUDED.industry,
          employee_count = EXCLUDED.employee_count,
          revenue = EXCLUDED.revenue,
          location = EXCLUDED.location,
          phone = EXCLUDED.phone,
          website = EXCLUDED.website,
          enriched_data = EXCLUDED.enriched_data,
          metadata = EXCLUDED.metadata, -- Update metadata
          is_deleted = EXCLUDED.is_deleted, -- Update is_deleted
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        apolloId,
        name,
        domain,
        industry,
        employeeCount,
        revenue,
        location,
        phone,
        website,
        JSON.stringify(enrichedData),
        tenantId, // Use tenantId
        userId,
        JSON.stringify(metadata), // Default metadata
        is_deleted // Default is_deleted
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('[Apollo Company] Error upserting company', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Find company by Apollo ID
   * LAD Architecture: Uses tenant_id, dynamic schema
   */
  static async findByApolloId(apolloId, tenantId, req = null) {
    try {
      const schema = getSchema(req);

      const result = await pool.query(`
        SELECT * FROM ${schema}.apollo_companies
        WHERE apollo_id = $1 AND tenant_id = $2 AND is_deleted = false
      `, [apolloId, tenantId]);

      return result.rows[0] || null;
    } catch (error) {
      logger.error('[Apollo Company] Error finding company', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Find companies by tenant
   * LAD Architecture: Uses tenant_id, dynamic schema
   */
  static async findByTenant(tenantId, options = {}, req = null) {
    try {
      const { limit = 50, offset = 0 } = options;
      const schema = getSchema(req);

      const result = await pool.query(`
        SELECT * FROM ${schema}.apollo_companies
        WHERE tenant_id = $1 AND is_deleted = false
        ORDER BY updated_at DESC
        LIMIT $2 OFFSET $3
      `, [tenantId, limit, offset]);

      return result.rows;
    } catch (error) {
      logger.error('[Apollo Company] Error finding companies', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

module.exports = ApolloCompany;
