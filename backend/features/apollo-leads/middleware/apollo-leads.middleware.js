/**
 * Apollo Leads Middleware
 * Middleware functions for apollo-leads feature
 */

const logger = require('../../../shared/utils/logger');

/**
 * Validate Apollo API parameters
 */
const validateApolloParams = (req, res, next) => {
  const { person_titles, q_organization_domains } = req.body;

  if (!person_titles && !q_organization_domains) {
    return res.status(400).json({
      error: 'At least one search parameter (person_titles or q_organization_domains) is required'
    });
  }

  next();
};

/**
 * Validate tenant context
 */
const validateTenantContext = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'] || req.query.tenantId || req.body.tenantId;

  if (!tenantId) {
    return res.status(400).json({
      error: 'Tenant ID is required'
    });
  }

  req.tenantId = tenantId;
  next();
};

/**
 * Log Apollo API requests
 */
const logApolloRequest = (req, res, next) => {
  logger.info('Apollo API Request', {
    method: req.method,
    path: req.path,
    tenantId: req.tenantId,
    body: req.body
  });

  next();
};

module.exports = {
  validateApolloParams,
  validateTenantContext,
  logApolloRequest
};
