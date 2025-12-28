/**
 * Application Constants
 * LAD Architecture Compliant - Centralized configuration
 * 
 * Centralizes all default values, magic strings, and configuration constants.
 * No hardcoded values in business logic - all defaults come from here or environment.
 */

/**
 * Apollo API Configuration
 */
const APOLLO_CONFIG = {
  // Default API base URL (can be overridden via APOLLO_API_BASE_URL)
  DEFAULT_BASE_URL: 'https://api.apollo.io/api/v1',
  
  // API endpoints
  ENDPOINTS: {
    ORGANIZATIONS_SEARCH: '/organizations/search',
    PEOPLE_SEARCH: '/people/search',
    MIXED_PEOPLE_SEARCH: '/mixed_people/search',
    PEOPLE_BULK_MATCH: '/people/bulk_match',
    ORGANIZATION_BY_ID: '/organizations'
  },
  
  // Default pagination
  DEFAULT_PER_PAGE: 100,
  MAX_PER_PAGE: 100,
  DEFAULT_PAGE: 1
};

/**
 * Database Configuration
 */
const DB_CONFIG = {
  // Default pagination for database queries
  DEFAULT_LIMIT: 50,
  DEFAULT_PAGE: 1,
  MAX_LIMIT: 1000,
  
  // Connection defaults (can be overridden via environment variables)
  DEFAULT_HOST: 'localhost',
  DEFAULT_PORT: 5432,
  DEFAULT_USER: 'postgres',
  DEFAULT_POOL_MAX: 20,
  DEFAULT_IDLE_TIMEOUT_MS: 30000,
  DEFAULT_CONNECTION_TIMEOUT_MS: 2000
};

/**
 * Search History Configuration
 */
const SEARCH_HISTORY_CONFIG = {
  DEFAULT_LIMIT: 50,
  DEFAULT_PAGE: 1,
  MAX_LIMIT: 100
};

/**
 * Credit Costs (Apollo API pricing)
 */
const CREDIT_COSTS = {
  SEARCH: 1,
  EMAIL_REVEAL: 1,
  PHONE_REVEAL: 8
};

/**
 * Cache Configuration
 */
const CACHE_CONFIG = {
  // Fake email patterns (for validation)
  FAKE_EMAIL_PATTERNS: [
    'email_not_unlocked',
    'not_unlocked',
    'placeholder',
    'noemail',
    'no-email',
    'unavailable',
    '@domain.com',
    '@example.com',
    'unlock@',
    'reveal@',
    'noreply',
    'no-reply',
    'donotreply',
    'do-not-reply'
  ]
};

/**
 * Timeout Configuration (milliseconds)
 */
const TIMEOUT_CONFIG = {
  APOLLO_API: 30000,      // 30 seconds
  APOLLO_SEARCH: 120000,  // 2 minutes
  DB_QUERY: 10000         // 10 seconds
};

/**
 * Environment Detection
 */
const ENV = {
  isProduction: () => process.env.NODE_ENV === 'production',
  isDevelopment: () => process.env.NODE_ENV === 'development' || !process.env.NODE_ENV,
  isTest: () => process.env.NODE_ENV === 'test'
};

module.exports = {
  APOLLO_CONFIG,
  DB_CONFIG,
  SEARCH_HISTORY_CONFIG,
  CREDIT_COSTS,
  CACHE_CONFIG,
  TIMEOUT_CONFIG,
  ENV
};

