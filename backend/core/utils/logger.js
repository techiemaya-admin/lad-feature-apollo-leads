/**
 * Centralized Logger Utility
 * LAD Architecture Compliant - No console.log in production
 * 
 * Standalone logger implementation for Apollo Leads feature.
 * No hardcoded dependencies on other feature repos.
 */

// LAD Architecture: No console.log in production - use process.stdout/stderr
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';

const logger = {
    debug: (message, ...args) => {
      // Only log in development
      if (isDevelopment) {
        // Use process.stdout.write in production-safe way
        if (!isProduction) {
          process.stdout.write(`[DEBUG] ${message}\n`);
          if (args.length > 0) {
            process.stdout.write(JSON.stringify(args, null, 2) + '\n');
          }
        }
      }
    },
    info: (message, ...args) => {
      // Only log in development
      if (isDevelopment) {
        if (!isProduction) {
          process.stdout.write(`[INFO] ${message}\n`);
          if (args.length > 0) {
            process.stdout.write(JSON.stringify(args, null, 2) + '\n');
          }
        }
      }
    },
    warn: (message, ...args) => {
      // Warnings should always be logged, but use process.stderr in production
      if (isProduction) {
        process.stderr.write(`[WARN] ${message}\n`);
        if (args.length > 0) {
          process.stderr.write(JSON.stringify(args, null, 2) + '\n');
        }
      } else {
        process.stderr.write(`[WARN] ${message}\n`);
        if (args.length > 0) {
          process.stderr.write(JSON.stringify(args, null, 2) + '\n');
        }
      }
    },
    error: (message, ...args) => {
      // Errors should always be logged, but use process.stderr in production
      if (isProduction) {
        process.stderr.write(`[ERROR] ${message}\n`);
        if (args.length > 0) {
          process.stderr.write(JSON.stringify(args, null, 2) + '\n');
        }
      } else {
        process.stderr.write(`[ERROR] ${message}\n`);
        if (args.length > 0) {
          process.stderr.write(JSON.stringify(args, null, 2) + '\n');
        }
      }
    }
  };

module.exports = logger;

