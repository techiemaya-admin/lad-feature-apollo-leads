/**
 * Configuration Management for Apollo Leads
 * Loads environment variables and provides defaults
 */

require('dotenv').config();

const config = {
  // Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT) || 3002,
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL,
  DB_SCHEMA: process.env.DB_SCHEMA,
  
  // Apollo API Configuration
  APOLLO_API_KEY: process.env.APOLLO_API_KEY,
  APOLLO_API_BASE_URL: process.env.APOLLO_API_BASE_URL || 'https://api.apollo.io',
  APOLLO_RATE_LIMIT_PER_HOUR: parseInt(process.env.APOLLO_RATE_LIMIT_PER_HOUR) || 1000,
  
  // Search Configuration
  DEFAULT_SEARCH_LIMIT: parseInt(process.env.DEFAULT_SEARCH_LIMIT) || 100,
  MAX_SEARCH_LIMIT: parseInt(process.env.MAX_SEARCH_LIMIT) || 1000,
  SEARCH_TIMEOUT: parseInt(process.env.SEARCH_TIMEOUT) || 30000, // 30 seconds
  
  // Data Processing
  LEAD_ENRICHMENT_ENABLED: process.env.LEAD_ENRICHMENT_ENABLED === 'true',
  DUPLICATE_DETECTION_ENABLED: process.env.DUPLICATE_DETECTION_ENABLED !== 'false',
  
  // Security
  JWT_SECRET: process.env.JWT_SECRET,
  CORS_ORIGINS: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [],
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  
  // Caching
  CACHE_TTL_SECONDS: parseInt(process.env.CACHE_TTL_SECONDS) || 3600, // 1 hour
  ENABLE_RESULT_CACHING: process.env.ENABLE_RESULT_CACHING !== 'false',
};

// Validation for required variables in production
if (config.NODE_ENV === 'production') {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'APOLLO_API_KEY', 'CORS_ORIGINS'];
  
  for (const key of required) {
    if (!config[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

module.exports = config;