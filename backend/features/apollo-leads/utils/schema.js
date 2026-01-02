/**
 * Schema Helper Utility
 * LAD Architecture: Get schema from environment
 */

function getSchema(req) {
  // Get schema from environment or default to public
  return process.env.DB_SCHEMA || 'public';
}

function requireTenantId(tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  return tenantId;
}

module.exports = { getSchema, requireTenantId };
