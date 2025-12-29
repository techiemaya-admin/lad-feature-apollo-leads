const logger = require('../../core/utils/logger');

/**
 * Credit Guard Middleware (Dev Mode - Skips Billing)
 * In production, this should check and deduct credits
 */
function requireCredits(creditType, amount) {
  return (req, res, next) => {
    // In dev mode, skip credit checks
    if (process.env.NODE_ENV === 'development' || process.env.DISABLE_CREDIT_GUARD === 'true') {
      logger.debug('[Credit Guard] Skipping credit check', { creditType, amount });
      return next();
    }
    
    // In production, check and deduct credits
    // TODO: Implement actual credit check
    logger.warn('[Credit Guard] Credit check not implemented', { creditType });
    next();
  };
}

module.exports = { requireCredits };
