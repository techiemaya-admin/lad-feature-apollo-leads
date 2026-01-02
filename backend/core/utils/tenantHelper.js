/**
 * Mock Tenant Helper for Testing
 */

function requireTenantId(tenantId, context = '') {
  // For testing, return a default tenant ID if none provided
  if (!tenantId) {
    return '00000000-0000-0000-0000-000000000001';
  }
  return tenantId;
}

module.exports = { requireTenantId };
