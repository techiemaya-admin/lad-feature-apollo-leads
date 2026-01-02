/**
 * Credit Guard Middleware (Mock)
 * For standalone testing
 */

function requireCredits(credits) {
  return (req, res, next) => {
    // For testing, always allow access
    // Credit check passed
    next();
  };
}

module.exports = { requireCredits };
