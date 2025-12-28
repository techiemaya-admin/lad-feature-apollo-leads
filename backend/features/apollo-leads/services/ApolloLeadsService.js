/**
 * Apollo Leads Service
 * LAD Architecture Compliant - Main service for Apollo.io lead generation
 * 
 * Coordinates between various specialized services:
 * - ApolloRevealService: Email and phone reveals
 * - ApolloFormatterService: Data formatting
 * - ApolloSearchHistoryService: Search history
 * - ApolloCacheService: Database cache operations
 */

const axios = require('axios');
const ApolloFormatterService = require('./ApolloFormatterService');
const ApolloPythonService = require('./ApolloPythonService');
const ApolloRevealService = require('./ApolloRevealService');
const { APOLLO_CONFIG, TIMEOUT_CONFIG } = require('../../../core/config/constants');
const logger = require('../../../core/utils/logger');

class ApolloLeadsService {
  constructor() {
    this.apiKey = process.env.APOLLO_API_KEY || process.env.APOLLO_IO_API_KEY;
    // LAD Architecture: Use environment variable for API base URL
    let baseURL = process.env.APOLLO_API_BASE_URL ?? APOLLO_CONFIG.DEFAULT_BASE_URL;
    
    // Fix common issue: if base URL is https://api.apollo.io/v2, convert to https://api.apollo.io/api/v2
    if (baseURL.includes('api.apollo.io') && !baseURL.includes('/api/')) {
      baseURL = baseURL.replace('api.apollo.io', 'api.apollo.io/api');
    }
    
    this.baseURL = baseURL;
    
    // Initialize reveal service
    this.revealService = new ApolloRevealService(this.apiKey, this.baseURL);
    
    if (!this.apiKey) {
      logger.warn('[Apollo Leads Service] Apollo API key not configured');
    }
    
    logger.debug('[Apollo Leads Service] Initialized', {
      baseURL: this.baseURL,
      hasApiKey: !!this.apiKey
    });
  }

  /**
   * Search companies using Apollo.io
   * @param {Object} searchParams - Search parameters
   * @param {Object} req - Express request object (for tenant context)
   */
  async searchCompanies(searchParams, req = null) {
    const {
      keywords = [],
      industry,
      location,
      company_size,
      revenue_range,
      technology,
      limit = 50,
      page = 1
    } = searchParams;

    try {
      const mainKeyword = keywords.length > 0 ? keywords[0] : '';
      
      const payload = {
        api_key: this.apiKey,
        q_organization_name: mainKeyword,
        page: page,
        per_page: Math.min(limit, APOLLO_CONFIG.MAX_PER_PAGE)
      };

      if (industry) {
        payload.industry_tag_ids = [industry];
      }
      
      if (location) {
        payload.organization_locations = [location];
      }
      
      if (company_size) {
        payload.organization_num_employees_ranges = [company_size];
      }

      const response = await axios.post(
        `${this.baseURL}${APOLLO_CONFIG.ENDPOINTS.ORGANIZATIONS_SEARCH}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey
          },
          timeout: TIMEOUT_CONFIG.APOLLO_API
        }
      );

      const companies = response.data.organizations || [];
      
      // Save search to history (if req context available)
      if (req) {
        try {
          const ApolloSearchHistoryService = require('./ApolloSearchHistoryService');
          await ApolloSearchHistoryService.saveSearchHistory({
            searchParams,
            results: companies.length,
            userId: req.user?.id || 'system'
          }, req);
        } catch (historyError) {
          logger.warn('[Apollo Leads] Failed to save search history', { error: historyError.message });
        }
      }

      return ApolloFormatterService.formatCompanies(companies);
    } catch (error) {
      logger.error('[Apollo Leads] Apollo API error', { error: error.response?.data || error.message });
      throw new Error(`Apollo search failed: ${error.message}`);
    }
  }

  /**
   * Get company details by ID
   */
  async getCompanyById(companyId) {
    try {
      const response = await axios.get(
        `${this.baseURL}${APOLLO_CONFIG.ENDPOINTS.ORGANIZATION_BY_ID}/${companyId}`,
        {
          headers: { 'X-Api-Key': this.apiKey }
        }
      );

      return ApolloFormatterService.formatCompany(response.data.organization);
    } catch (error) {
      logger.error('[Apollo Leads] Get company error', { error: error.message, stack: error.stack });
      throw new Error(`Failed to get company: ${error.message}`);
    }
  }

  /**
   * Get company leads (employees)
   */
  async getCompanyLeads(companyId, options = {}) {
    const { limit = 25, page = 1, title_filter } = options;

    try {
      const payload = {
        q_organization_ids: [companyId],
        page,
        per_page: limit
      };

      if (title_filter) {
        payload.q_person_titles = [title_filter];
      }

      const response = await axios.post(
        `${this.baseURL}${APOLLO_CONFIG.ENDPOINTS.PEOPLE_SEARCH}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey
          }
        }
      );

      return ApolloFormatterService.formatLeads(response.data.people || []);
    } catch (error) {
      logger.error('[Apollo Leads] Get leads error', { error: error.message, stack: error.stack });
      throw new Error(`Failed to get leads: ${error.message}`);
    }
  }

  /**
   * Reveal email - delegates to ApolloRevealService
   */
  async revealEmail(personId, employeeName = null, req = null) {
    return this.revealService.revealEmail(personId, employeeName, req);
  }
  
  /**
   * Reveal phone - delegates to ApolloRevealService
   */
  async revealPhone(personId, employeeName = null, req = null) {
    return this.revealService.revealPhone(personId, employeeName, req);
  }

  /**
   * Search history methods - delegate to ApolloSearchHistoryService
   */
  async saveSearchHistory(searchData, req = null) {
    const ApolloSearchHistoryService = require('./ApolloSearchHistoryService');
    return ApolloSearchHistoryService.saveSearchHistory(searchData, req);
  }

  async getSearchHistory(userId, options = {}, req = null) {
    const ApolloSearchHistoryService = require('./ApolloSearchHistoryService');
    return ApolloSearchHistoryService.getSearchHistory(userId, options, req);
  }

  async deleteSearchHistory(historyId, userId, req = null) {
    const ApolloSearchHistoryService = require('./ApolloSearchHistoryService');
    return ApolloSearchHistoryService.deleteSearchHistory(historyId, userId, req);
  }

  /**
   * Format methods - delegate to ApolloFormatterService
   */
  formatCompanies(companies) {
    return ApolloFormatterService.formatCompanies(companies);
  }

  formatCompany(company) {
    return ApolloFormatterService.formatCompany(company);
  }

  formatLeads(people) {
    return ApolloFormatterService.formatLeads(people);
  }

  /**
   * Call Python Apollo service - delegate to ApolloPythonService
   */
  _callApolloService(method, params = {}) {
    return ApolloPythonService.callApolloService(method, params);
  }

  /**
   * Search employees from database cache
   * Delegates to ApolloCacheService
   */
  async searchEmployeesFromDb(searchParams, req = null) {
    const { searchEmployeesFromDb } = require('./ApolloCacheService');
    return searchEmployeesFromDb(searchParams, req);
  }
}

module.exports = new ApolloLeadsService();
