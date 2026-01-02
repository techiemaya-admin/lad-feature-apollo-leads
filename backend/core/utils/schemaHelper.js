/**
 * Schema Helper
 * Returns the correct schema for the tenant
 * LAD Architecture: Dynamic tenant schema resolution
 */

function getSchema(req) {
  // Support both old (tenantId) and new (req object) calling patterns
  let tenantId = null;
  
  // If req is a string, it's the old tenantId parameter
  if (typeof req === 'string') {
    tenantId = req;
  } else if (req) {
    // Extract tenant from request object (LAD Architecture)
    tenantId = req.user?.tenant_id || req.tenant?.id || req.headers?.['x-tenant-id'];
  }
  
  // Default schema is lad_dev (not 'public')
  const defaultSchema = process.env.DEFAULT_SCHEMA || 'lad_dev';
  
  // For now, always return lad_dev (single-tenant)
  // In production with multi-tenant, this would resolve different schemas per tenant
  return defaultSchema;
}

module.exports = { getSchema };
