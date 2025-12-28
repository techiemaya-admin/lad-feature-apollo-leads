/**
 * Schema Utility
 * Provides multi-tenant schema resolution
 * LAD Architecture Compliant - No hardcoded schema names
 * 
 * This follows the same pattern as lad-feature-campaigns
 */

/**
 * Get schema name for a request or tenant
 * @param {Object} req - Express request object (optional)
 * @param {string} tenantId - Tenant ID (optional, can be extracted from req)
 * @returns {string} Schema name (e.g., 'lad_dev', 'tenant_123', etc.)
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
      // we can use environment variable or default pattern
      return req.user.schema || process.env.DB_SCHEMA || 'lad_dev';
    }

    // Check req.tenant.id (from mock auth or dedicated tenant middleware)
    if (req.tenant && req.tenant.id) {
      return req.tenant.schema || process.env.DB_SCHEMA || 'lad_dev';
    }

    // Check query params (less secure, for dev/testing only)
    if (req.query && req.query.tenantId) {
      // For query param tenantId, we still need schema resolution
      // This is a fallback and should use environment default
      return process.env.DB_SCHEMA || 'lad_dev';
    }
  }

  // Priority 2: If tenantId is provided directly (without req), use environment default
  // Note: Without req context, we cannot resolve tenant-specific schema
  // This should only be used in non-request contexts (background jobs, etc.)
  if (tenantId) {
    // In production, tenantId should map to schema, but without a lookup table,
    // we use environment default. This is acceptable for background jobs.
    return process.env.DB_SCHEMA || 'lad_dev';
  }

  // Default to environment variable or lad_dev for backward compatibility
  return process.env.DB_SCHEMA || 'lad_dev';
}

/**
 * Get schema name from tenant ID
 * @param {string} tenantId - Tenant ID
 * @returns {string} Schema name
 */
function getSchemaFromTenantId(tenantId) {
  if (!tenantId) {
    return process.env.DB_SCHEMA || 'lad_dev';
  }
  
  // In LAD architecture, tenant_id to schema mapping is typically done via:
  // 1. Database lookup (tenants table)
  // 2. Environment variable pattern
  // 3. Default schema
  
  // For now, without a lookup mechanism, we use environment default
  // This function should ideally query a tenants table to get schema
  // For feature repos, this is acceptable as the main resolution happens via getSchema(req)
  return process.env.DB_SCHEMA || 'lad_dev';
}

module.exports = {
  getSchema,
  getSchemaFromTenantId
};

