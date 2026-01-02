/**
 * Feature Guard Middleware (Mock)
 * For standalone testing
 */

function requireFeature(featureName) {
  return (req, res, next) => {
    // For testing, always allow access
    // Feature access granted
    next();
  };
}

module.exports = { requireFeature };
