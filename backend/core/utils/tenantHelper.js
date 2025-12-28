/**
 * Tenant Helper Utility
 * LAD Architecture Compliant - Safe tenant ID resolution
 * 
 * Provides centralized tenant ID resolution with proper error handling.
 * Never hardcodes tenant IDs - always requires explicit context or throws error.
 */

const logger = require('./logger');

/**
 * Require tenant ID from request context
 * Throws error if tenant ID is missing in production
 * 
 * @param {string|null|undefined} tenantId - Tenant ID from request
 * @param {Object|null} req - Express request object (optional)
 * @param {string} context - Context for error message (e.g., "revealEmail")
 * @returns {string} Valid tenant ID
 * @throws {Error} If tenant ID is missing in production
 */
function requireTenantId(tenantId, req = null, context = 'operation') {
  // Priority 1: Explicit tenantId parameter
  if (tenantId) {
    return String(tenantId);
  }

  // Priority 2: Extract from request object
  if (req) {
    const fromReq = req.user?.tenant_id || req.tenant?.id || req.headers?.['x-tenant-id'];
    if (fromReq) {
      return String(fromReq);
    }
  }

  // Priority 3: Development fallback (only in non-production environments)
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const devTenantId = process.env.DEV_TENANT_ID;
    if (devTenantId) {
      logger.warn(`[Tenant Helper] Using DEV_TENANT_ID fallback for ${context}`, {
        context,
        devTenantId: devTenantId.substring(0, 8) + '...'
      });
      return String(devTenantId);
    }
  }

  // Production: Throw error if tenant ID is missing
  if (isProduction) {
    logger.error(`[Tenant Helper] Tenant context required for ${context}`, {
      context,
      hasReq: !!req,
      hasUser: !!req?.user,
      hasTenant: !!req?.tenant,
      hasHeader: !!req?.headers?.['x-tenant-id']
    });
    throw new Error(`Tenant context required for ${context}. Tenant ID must be provided via request context or headers.`);
  }

  // Development: Last resort fallback (should not happen if DEV_TENANT_ID is set)
  logger.error(`[Tenant Helper] No tenant ID available for ${context} - this should not happen`, {
    context,
    nodeEnv: process.env.NODE_ENV
  });
  throw new Error(`Tenant context required for ${context}. Set DEV_TENANT_ID environment variable for development.`);
}

/**
 * Get tenant ID from request (non-throwing version)
 * Returns null if tenant ID cannot be resolved
 * 
 * @param {Object|null} req - Express request object
 * @returns {string|null} Tenant ID or null
 */
function getTenantIdFromRequest(req) {
  if (!req) {
    return null;
  }

  return req.user?.tenant_id || req.tenant?.id || req.headers?.['x-tenant-id'] || null;
}

/**
 * Validate tenant ID format (UUID v4)
 * 
 * @param {string} tenantId - Tenant ID to validate
 * @returns {boolean} True if valid UUID format
 */
function isValidTenantId(tenantId) {
  if (!tenantId || typeof tenantId !== 'string') {
    return false;
  }

  // UUID v4 format: 8-4-4-4-12 hex digits
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(tenantId);
}

module.exports = {
  requireTenantId,
  getTenantIdFromRequest,
  isValidTenantId
};

