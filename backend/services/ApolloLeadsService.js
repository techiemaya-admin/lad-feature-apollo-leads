const axios = require('axios');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { pool } = require('../../../shared/database/connection');
const { APOLLO_CONFIG } = require('../core/config/constants');
const logger = require('../core/utils/logger');

class ApolloLeadsService {
  constructor() {
    this.apiKey = process.env.APOLLO_API_KEY || process.env.APOLLO_IO_API_KEY;
    // LAD Architecture: Use environment variable or constants (no hardcoded URLs)
    let baseURL = process.env.APOLLO_API_BASE_URL || APOLLO_CONFIG.DEFAULT_BASE_URL;
    
    // Fix common issue: if base URL is https://api.apollo.io/v2, convert to https://api.apollo.io/api/v2
    if (baseURL.includes('api.apollo.io') && !baseURL.includes('/api/')) {
      baseURL = baseURL.replace('api.apollo.io', 'api.apollo.io/api');
    }
    
    this.baseURL = baseURL;
    
    if (!this.apiKey) {
      logger.warn('[Apollo Leads] Apollo API key not configured');
    }
  }

  async searchCompanies(searchParams) {
    // Feature access is checked by middleware

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
      // Build Apollo API request payload
      const payload = {
        q_keywords: keywords.join(' '),
        page: page,
        per_page: Math.min(limit, 100) // Apollo max is 100 per page
      };

      // Add optional filters
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
        `${this.baseURL}/mixed_companies/search`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey
          },
          timeout: 30000
        }
      );

      const companies = response.data.organizations || [];
      
      // Save search to history
      await this.saveSearchHistory({
        searchParams,
        results: companies.length,
        userId: 'demo-user' // In real app, get from context
      });

      return this.formatCompanies(companies);
    } catch (error) {
      logger.error('[Apollo Leads] Apollo API error', { error: error.response?.data || error.message });
      throw new Error(`Apollo search failed: ${error.message}`);
    }
  }

  async getCompanyById(companyId) {
    if (!isFeatureEnabled('apollo_leads')) {
      throw new Error('Apollo Leads feature is disabled');
    }

    try {
      // LAD Architecture: Use endpoint constant (no hardcoded paths)
      const response = await axios.get(
        `${this.baseURL}${APOLLO_CONFIG.ENDPOINTS.ORGANIZATION_BY_ID}/${companyId}`,
        {
          headers: { 'X-Api-Key': this.apiKey }
        }
      );

      return this.formatCompany(response.data.organization);
    } catch (error) {
      logger.error('[Apollo Leads] Get company error', { error: error.message, stack: error.stack });
      throw new Error(`Failed to get company: ${error.message}`);
    }
  }

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

      // LAD Architecture: Use endpoint constant (no hardcoded paths)
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

      return this.formatLeads(response.data.people || []);
    } catch (error) {
      logger.error('[Apollo Leads] Get leads error', { error: error.message, stack: error.stack });
      throw new Error(`Failed to get leads: ${error.message}`);
    }
  }

  async revealEmail(personId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/people/bulk_match`,
        {
          details: [{ id: personId }],
          reveal_personal_emails: true,
          reveal_phone_number: false
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey
          }
        }
      );

      const person = response.data?.matches?.[0];
      return person?.email || null;
    } catch (error) {
      logger.error('[Apollo Leads] Reveal email error', { error: error.message, stack: error.stack });
      throw new Error(`Email reveal failed: ${error.message}`);
    }
  }

  async revealPhone(personId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/people/bulk_match`,
        {
          details: [{ id: personId }],
          reveal_personal_emails: false,
          reveal_phone_number: true
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey
          }
        }
      );

      const person = response.data?.matches?.[0];
      return person?.phone_numbers?.[0]?.raw_number || null;
    } catch (error) {
      logger.error('[Apollo Leads] Reveal phone error', { error: error.message, stack: error.stack });
      throw new Error(`Phone reveal failed: ${error.message}`);
    }
  }

  async saveSearchHistory(searchData) {
    try {
      const query = `
        INSERT INTO apollo_search_history (user_id, search_params, results_count, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING id
      `;
      
      await pool.query(query, [
        searchData.userId,
        JSON.stringify(searchData.searchParams),
        searchData.results
      ]);
    } catch (error) {
      logger.error('[Apollo Leads] Save search history error', { error: error.message, stack: error.stack });
      // Don't throw - this is not critical
    }
  }

  async getSearchHistory(userId, options = {}, req = null) {
    const { limit = 50, page = 1 } = options;
    const offset = (page - 1) * limit;

    try {
      // LAD Architecture: Extract tenant context
      const tenantId = req?.user?.tenant_id || req?.tenant?.id || req?.headers?.['x-tenant-id'];
      
      // Note: If apollo_search_history table has tenant_id column, add: AND tenant_id = $X
      // For now, filtering by user_id (users should be tenant-scoped)
      const query = `
        SELECT id, search_params, results_count, created_at
        FROM apollo_search_history
        WHERE user_id = $1${tenantId ? ' AND tenant_id = $4' : ''}
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      
      const params = tenantId ? [userId, limit, offset, tenantId] : [userId, limit, offset];
      const result = await pool.query(query, params);
      return result.rows.map(row => ({
        ...row,
        search_params: JSON.parse(row.search_params)
      }));
    } catch (error) {
      logger.error('[Apollo Leads] Get search history error', { error: error.message, stack: error.stack });
      return [];
    }
  }

  async deleteSearchHistory(historyId, userId) {
    try {
      const query = `
        DELETE FROM apollo_search_history
        WHERE id = $1 AND user_id = $2
      `;
      
      await pool.query(query, [historyId, userId]);
    } catch (error) {
      logger.error('[Apollo Leads] Delete search history error', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  formatCompanies(companies) {
    return companies.map(this.formatCompany);
  }

  formatCompany(company) {
    return {
      id: company.id,
      name: company.name,
      website: company.website_url,
      domain: company.primary_domain,
      industry: company.primary_vertical,
      location: {
        country: company.organization_raw_address_country,
        city: company.organization_raw_address_city,
        state: company.organization_raw_address_state
      },
      size: company.num_current_employees,
      revenue: company.estimated_num_employees,
      description: company.short_description,
      technologies: company.technology_names || [],
      apollo_id: company.id,
      linkedin_url: company.linkedin_url,
      twitter_url: company.twitter_url,
      facebook_url: company.facebook_url,
      created_at: new Date().toISOString()
    };
  }

  formatLeads(people) {
    return people.map(person => ({
      id: person.id,
      name: person.name,
      first_name: person.first_name,
      last_name: person.last_name,
      title: person.title,
      email: person.email,
      phone: person.phone_numbers?.[0]?.raw_number,
      linkedin_url: person.linkedin_url,
      company_id: person.organization?.id,
      company_name: person.organization?.name,
      location: {
        country: person.country,
        city: person.city,
        state: person.state
      },
      apollo_id: person.id,
      created_at: new Date().toISOString()
    }));
  }

  /**
   * Helper function to call Python Apollo service
   * Uses LAD_SCRIPTS_PATH environment variable (LAD architecture compliant)
   * Falls back to API endpoint if Python script is not available
   */
  _callApolloService(method, params = {}) {
    return new Promise((resolve, reject) => {
      // LAD RULE: Use environment variable, NEVER guess paths
      // Path guessing is FORBIDDEN in LAD architecture
      let scriptPath = null;
      const fs = require('fs');
      
      // Priority 1: LAD_SCRIPTS_PATH (for local development with symlink)
      if (process.env.LAD_SCRIPTS_PATH) {
        const candidatePath = path.join(process.env.LAD_SCRIPTS_PATH, 'apollo_service.py');
        if (fs.existsSync(candidatePath)) {
          scriptPath = candidatePath;
          logger.debug('[Apollo Leads] Using script from LAD_SCRIPTS_PATH', { path: scriptPath });
        }
      }
      
      // Priority 2: APOLLO_SERVICE_SCRIPT_PATH (direct path override)
      if (!scriptPath && process.env.APOLLO_SERVICE_SCRIPT_PATH) {
        if (fs.existsSync(process.env.APOLLO_SERVICE_SCRIPT_PATH)) {
          scriptPath = process.env.APOLLO_SERVICE_SCRIPT_PATH;
          logger.debug('[Apollo Leads] Using script from APOLLO_SERVICE_SCRIPT_PATH', { path: scriptPath });
        }
      }
      
      // Priority 3: Standard LAD location (when merged to LAD)
      if (!scriptPath) {
        // Try standard LAD location: backend/shared/services/apollo_service.py
        // This is relative to where the service is running (LAD backend root)
        const standardPath = path.join(process.cwd(), 'backend', 'shared', 'services', 'apollo_service.py');
        if (fs.existsSync(standardPath)) {
          scriptPath = standardPath;
          logger.debug('[Apollo Leads] Using script from standard LAD location', { path: scriptPath });
        }
      }
      
      // If Python script not found, reject to trigger fallback
      if (!scriptPath) {
        logger.warn('[Apollo Leads] Python script not found. Set LAD_SCRIPTS_PATH or APOLLO_SERVICE_SCRIPT_PATH env var.');
        logger.debug('[Apollo Leads] For local dev: cd LAD/backend && ln -s ./core/scripts ./scripts && export LAD_SCRIPTS_PATH=$(pwd)/scripts');
        reject(new Error('Python script not found - will use API endpoint'));
        return;
      }
      
      // Find Python executable - try python3, python, then py (Windows)
      let pythonExec = null;
      const pythonExecs = ['python3', 'python', 'py'];
      
      for (const exec of pythonExecs) {
        try {
          execSync(`${exec} --version`, { stdio: 'ignore' });
          pythonExec = exec;
          break;
        } catch (e) {
          // Try next executable
        }
      }
      
      // If no Python executable found, reject to trigger fallback
      if (!pythonExec) {
        reject(new Error('Python not found - will use API endpoint'));
        return;
      }
      
      logger.debug('[Apollo Leads] Using Python executable', { executable: pythonExec, script: scriptPath });
      const pythonProcess = spawn(pythonExec, [scriptPath, method, JSON.stringify(params)]);
      
      let output = '';
      let error = '';
      
      // Handle spawn errors
      pythonProcess.on('error', (spawnError) => {
        reject(new Error(`Python process error: ${spawnError.message}`));
      });
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        const errorText = data.toString();
        error += errorText;
        logger.debug('[Apollo Leads] [Python]', { output: errorText.trim() });
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            // Extract JSON from output
            let jsonString = output.trim();
            
            // Find the first '{' or '[' to identify where JSON starts
            const firstBrace = jsonString.indexOf('{');
            const firstBracket = jsonString.indexOf('[');
            let jsonStart = -1;
            let startChar = '';
            
            if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
              jsonStart = firstBrace;
              startChar = '{';
            } else if (firstBracket !== -1) {
              jsonStart = firstBracket;
              startChar = '[';
            }
            
            if (jsonStart > 0) {
              jsonString = jsonString.substring(jsonStart);
            }
            
            // Find matching closing bracket/brace
            let depth = 0;
            let jsonEnd = -1;
            const endChar = startChar === '{' ? '}' : ']';
            
            for (let i = 0; i < jsonString.length; i++) {
              if (jsonString[i] === startChar) {
                depth++;
              } else if (jsonString[i] === endChar) {
                depth--;
                if (depth === 0) {
                  jsonEnd = i;
                  break;
                }
              }
            }
            
            if (jsonEnd !== -1) {
              jsonString = jsonString.substring(0, jsonEnd + 1);
            }
            
            const result = JSON.parse(jsonString);
            
            // For search_people_direct, return the full result object
            if (result.success !== undefined && result.employees) {
              resolve(result);
            } else if (result.companies) {
              resolve(result.companies);
            } else if (result.leads) {
              resolve(result.leads);
            } else if (result.employees && !result.success) {
              resolve(result.employees);
            } else if (Array.isArray(result)) {
              resolve(result);
            } else {
              resolve(result);
            }
          } catch (e) {
            logger.error('[Apollo Leads] JSON Parse Error', { error: e.message, output: output.substring(0, 500) });
            reject(new Error('Failed to parse Python output: ' + e.message));
          }
        } else {
          reject(new Error('Python process failed: ' + error));
        }
      });
    });
  }

  /**
   * Search employees from database cache (employees_cache table)
   * Falls back to Apollo API if no results found in database
   * 
   * @param {Object} searchParams - Search parameters
   * @param {number} page - Page number (default: 1)
   * @param {number} per_page - Results per page (default: 100)
   * @returns {Promise<Object>} { success, employees, count }
   * 
   * NOTE: This method has been moved to ApolloCacheService.js
   * This is kept for backward compatibility
   */
  async searchEmployeesFromDb(searchParams) {
    const { searchEmployeesFromDb } = require('./ApolloCacheService');
    return searchEmployeesFromDb(searchParams);
  }
  
}

module.exports = new ApolloLeadsService();