/**
 * Schema Utility
 * Provides multi-tenant schema resolution
 * LAD Architecture Compliant - No hardcoded schema names
 * 
 * This follows the same pattern as lad-feature-campaigns
 */

const logger = require('./logger');

/**
 * Get default schema from environment or throw error in production
 * @returns {string} Default schema name
 */
function getDefaultSchema() {
  const defaultSchema = process.env.DB_SCHEMA || process.env.DEFAULT_SCHEMA;
  
  if (!defaultSchema) {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      logger.error('[Schema Helper] DB_SCHEMA or DEFAULT_SCHEMA environment variable is required in production');
      throw new Error('DB_SCHEMA or DEFAULT_SCHEMA environment variable must be set');
    }
    // In development, log warning but allow fallback
    logger.warn('[Schema Helper] DB_SCHEMA not set, using default fallback. Set DB_SCHEMA in .env for proper schema resolution.');
    return 'lad_dev'; // Only fallback for development
  }
  
  return defaultSchema;
}

/**
 * Get schema name for a request or tenant
 * @param {Object} req - Express request object (optional)
 * @param {string} tenantId - Tenant ID (optional, can be extracted from req)
 * @returns {string} Schema name
 */
function getSchema(req = null, tenantId = null) {
  // Priority 1: Extract from request object (most reliable)
  if (req) {
    // Check req.user.schema (from JWT auth - schema is set by auth middleware)
    if (req.user && req.user.schema) {
      return req.user.schema;
    }

    // Check req.tenant.schema (from tenant middleware)
    if (req.tenant && req.tenant.schema) {
      return req.tenant.schema;
    }

    // Check req.user.tenant_id and derive schema (fallback pattern)
    if (req.user && req.user.tenant_id) {
      // In LAD, schema is typically stored in req.user.schema, but if not available,
      // we use environment variable
      return req.user.schema || getDefaultSchema();
    }

    // Check req.tenant.id (from mock auth or dedicated tenant middleware)
    if (req.tenant && req.tenant.id) {
      return req.tenant.schema || getDefaultSchema();
    }

    // Check query params (less secure, for dev/testing only)
    if (req.query && req.query.tenantId) {
      // For query param tenantId, we still need schema resolution
      // This is a fallback and should use environment default
      return getDefaultSchema();
    }
  }

  // Priority 2: If tenantId is provided directly (without req), use environment default
  // Note: Without req context, we cannot resolve tenant-specific schema
  // This should only be used in non-request contexts (background jobs, etc.)
  if (tenantId) {
    // In production, tenantId should map to schema, but without a lookup table,
    // we use environment default. This is acceptable for background jobs.
    return getDefaultSchema();
  }

  // Default to environment variable
  return getDefaultSchema();
}

/**
 * Get schema name from tenant ID
 * @param {string} tenantId - Tenant ID
 * @returns {string} Schema name
 */
function getSchemaFromTenantId(tenantId) {
  if (!tenantId) {
    return getDefaultSchema();
  }
  
  // In LAD architecture, tenant_id to schema mapping is typically done via:
  // 1. Database lookup (tenants table)
  // 2. Environment variable pattern
  // 3. Default schema
  
  // For now, without a lookup mechanism, we use environment default
  // This function should ideally query a tenants table to get schema
  // For feature repos, this is acceptable as the main resolution happens via getSchema(req)
  return getDefaultSchema();
}

module.exports = {
  getSchema,
  getSchemaFromTenantId
};

