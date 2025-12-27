const axios = require('axios');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { pool } = require('../../../shared/database/connection');

class ApolloLeadsService {
  constructor() {
    this.apiKey = process.env.APOLLO_API_KEY || process.env.APOLLO_IO_API_KEY;
    this.baseURL = 'https://api.apollo.io/v1';
    
    if (!this.apiKey) {
      console.warn('⚠️ Apollo API key not configured');
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
      console.error('Apollo API error:', error.response?.data || error.message);
      throw new Error(`Apollo search failed: ${error.message}`);
    }
  }

  async getCompanyById(companyId) {
    if (!isFeatureEnabled('apollo_leads')) {
      throw new Error('Apollo Leads feature is disabled');
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/organizations/${companyId}`,
        {
          headers: { 'X-Api-Key': this.apiKey }
        }
      );

      return this.formatCompany(response.data.organization);
    } catch (error) {
      console.error('Apollo get company error:', error);
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

      const response = await axios.post(
        `${this.baseURL}/people/search`,
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
      console.error('Apollo get leads error:', error);
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
      console.error('Apollo reveal email error:', error);
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
      console.error('Apollo reveal phone error:', error);
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
      console.error('Save search history error:', error);
      // Don't throw - this is not critical
    }
  }

  async getSearchHistory(userId, options = {}) {
    const { limit = 50, page = 1 } = options;
    const offset = (page - 1) * limit;

    try {
      const query = `
        SELECT id, search_params, results_count, created_at
        FROM apollo_search_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      
      const result = await pool.query(query, [userId, limit, offset]);
      return result.rows.map(row => ({
        ...row,
        search_params: JSON.parse(row.search_params)
      }));
    } catch (error) {
      console.error('Get search history error:', error);
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
      console.error('Delete search history error:', error);
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
   * Helper function to call Python Apollo service (like pluto_campaigns)
   * Falls back to API endpoint if Python script is not available
   */
  _callApolloService(method, params = {}) {
    return new Promise((resolve, reject) => {
      // Try to find Python script in sts-service (if available)
      const possibleScriptPaths = [
        path.join(__dirname, '../../../../sts-service/scripts/apollo_service.py'),
        path.join(__dirname, '../../../../pluto_campains/pluto_v8/sts-service/scripts/apollo_service.py'),
        path.join(__dirname, '../../../../pluto_v8/sts-service/scripts/apollo_service.py')
      ];
      
      let scriptPath = null;
      for (const possiblePath of possibleScriptPaths) {
        try {
          const fs = require('fs');
          if (fs.existsSync(possiblePath)) {
            scriptPath = possiblePath;
            break;
          }
        } catch (e) {
          // Continue to next path
        }
      }
      
      // If Python script not found, reject to trigger fallback
      if (!scriptPath) {
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
      
      console.log(`[Apollo Leads] 🐍 Using Python executable: ${pythonExec}`);
      console.log(`[Apollo Leads] 📜 Using script: ${scriptPath}`);
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
        console.log('[Apollo Leads] [Python]', errorText.trim());
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
            console.error('[Apollo Leads] JSON Parse Error:', e.message);
            console.error('[Apollo Leads] Output (first 500 chars):', output.substring(0, 500));
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