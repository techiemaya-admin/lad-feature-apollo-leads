
/**
 * Feature Guard Middleware (Dev Mode - Allows All)
 * In production, this should check user's feature access
 */
function requireFeature(featureName) {
  return (req, res, next) => {
    // In dev mode, allow all features
    if (process.env.NODE_ENV === 'development' || process.env.DISABLE_FEATURE_GUARD === 'true') {
      console.log(`[Feature Guard] Allowing feature: ${featureName}`);
      return next();
    }
    
    // In production, check user's feature access
    // TODO: Implement actual feature check
    console.warn(`[Feature Guard] Feature check not implemented for: ${featureName}`);
    next();
  };
}

module.exports = { requireFeature };
