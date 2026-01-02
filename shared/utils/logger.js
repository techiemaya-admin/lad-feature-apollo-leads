/**
 * Production Logger Utility for Apollo Leads
 * Provides structured logging with environment-based levels
 */

class Logger {
  constructor(context = 'Apollo-Leads') {
    this.context = context;
    this.level = process.env.LOG_LEVEL || 'info';
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
  }

  log(level, message, metadata = {}) {
    if (this.levels[level] <= this.levels[this.level]) {
      const timestamp = new Date().toISOString();
      const logData = {
        timestamp,
        level: level.toUpperCase(),
        context: this.context,
        message,
        ...metadata
      };

      if (process.env.NODE_ENV === 'production') {
        process.stdout.write(JSON.stringify(logData) + '\n');
      }
    }
  }

  info(message, metadata) {
    this.log('info', message, metadata);
  }

  error(message, metadata) {
    this.log('error', message, metadata);
  }

  warn(message, metadata) {
    this.log('warn', message, metadata);
  }

  debug(message, metadata) {
    this.log('debug', message, metadata);
  }
}

const logger = new Logger('Apollo-Leads');

module.exports = logger;