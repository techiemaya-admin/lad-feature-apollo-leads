/**
 * Credit Guard Middleware (Mock)
 * For standalone testing
 */

function requireCredits(credits) {
  return (req, res, next) => {
    // For testing, always allow access
    console.log(`[CreditGuard] Checking credits: ${credits} - ALLOWED`);
    next();
  };
}

module.exports = { requireCredits };
