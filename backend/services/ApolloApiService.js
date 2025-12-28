/**
 * Apollo API Service
 * Handles Apollo API calls and Python script execution
 * LAD Architecture Compliant
 */

const axios = require('axios');
const path = require('path');
const { spawn, execSync } = require('child_process');
const logger = require('../core/utils/logger');

/**
 * Helper function to call Python Apollo service
 * Uses LAD_SCRIPTS_PATH environment variable (LAD architecture compliant)
 * Falls back to API endpoint if Python script is not available
 */
function callApolloService(method, params = {}) {
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
        logger.debug('[Apollo API] Using script from LAD_SCRIPTS_PATH', { path: scriptPath });
      }
    }
    
    // Priority 2: APOLLO_SERVICE_SCRIPT_PATH (direct path override)
    if (!scriptPath && process.env.APOLLO_SERVICE_SCRIPT_PATH) {
      if (fs.existsSync(process.env.APOLLO_SERVICE_SCRIPT_PATH)) {
        scriptPath = process.env.APOLLO_SERVICE_SCRIPT_PATH;
        logger.debug('[Apollo API] Using script from APOLLO_SERVICE_SCRIPT_PATH', { path: scriptPath });
      }
    }
    
    // Priority 3: Standard LAD location (when merged to LAD)
    if (!scriptPath) {
      // Try standard LAD location: backend/shared/services/apollo_service.py
      // This is relative to where the service is running (LAD backend root)
      const standardPath = path.join(process.cwd(), 'backend', 'shared', 'services', 'apollo_service.py');
      if (fs.existsSync(standardPath)) {
        scriptPath = standardPath;
        logger.debug('[Apollo API] Using script from standard LAD location', { path: scriptPath });
      }
    }
    
    // If Python script not found, reject to trigger fallback
    if (!scriptPath) {
      logger.warn('[Apollo API] Python script not found. Set LAD_SCRIPTS_PATH or APOLLO_SERVICE_SCRIPT_PATH env var.');
      logger.debug('[Apollo API] For local dev: cd LAD/backend && ln -s ./core/scripts ./scripts && export LAD_SCRIPTS_PATH=$(pwd)/scripts');
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
    
    logger.debug('[Apollo API] Using Python executable', { executable: pythonExec, script: scriptPath });
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
      logger.debug('[Apollo API] [Python]', { output: errorText.trim() });
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
          logger.error('[Apollo API] JSON Parse Error', { error: e.message, output: output.substring(0, 500) });
          reject(new Error('Failed to parse Python output: ' + e.message));
        }
      } else {
        reject(new Error('Python process failed: ' + error));
      }
    });
  });
}

/**
 * Call Apollo API via HTTP endpoint
 */
async function callApolloApi(searchParams) {
  // LAD Architecture: Use environment variable for backend URL (no hardcoded URLs)
  const PRODUCTION_BACKEND_URL = process.env.BACKEND_URL || 
                                 process.env.NEXT_PUBLIC_BACKEND_URL;
  
  if (!PRODUCTION_BACKEND_URL) {
    throw new Error('BACKEND_URL or NEXT_PUBLIC_BACKEND_URL environment variable is required');
  }
  
  logger.debug('[Apollo API] Calling Apollo API via production backend', { url: `${PRODUCTION_BACKEND_URL}/api/apollo-leads/search-employees` });
  
  const apolloResponse = await axios.post(
    `${PRODUCTION_BACKEND_URL}/api/apollo-leads/search-employees`,
    searchParams,
    {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minutes for Apollo API
    }
  );
  
  return apolloResponse.data;
}

/**
 * Search employees from Apollo API (with fallback)
 */
async function searchEmployeesFromApollo(searchParams) {
  const {
    organization_locations = [],
    person_titles = [],
    organization_industries = [],
    per_page = 100,
    page = 1
  } = searchParams;
  
  const apolloPerPage = 100; // Always request 100 from Apollo
  
  logger.info('[Apollo API] Attempting to call Apollo API', {
    organization_locations,
    person_titles,
    organization_industries,
    per_page: apolloPerPage,
    page
  });
  
  // Check if Apollo API key is configured
  const apiKey = process.env.APOLLO_API_KEY || process.env.APOLLO_IO_API_KEY;
  if (!apiKey) {
    logger.error('[Apollo API] Apollo API key not configured');
    throw new Error('Apollo API key not configured');
  }
  logger.debug('[Apollo API] API key found');
  
  try {
    logger.debug('[Apollo API] Attempting to call Apollo via Python script');
    const apolloResult = await callApolloService('search_people_direct', {
      organization_locations: organization_locations,
      person_titles: person_titles,
      organization_industries: organization_industries,
      per_page: apolloPerPage,
      page: page || 1
    });
    logger.info('[Apollo API] Successfully called Apollo via Python script', {
      success: apolloResult?.success,
      employeesCount: apolloResult?.employees?.length || 0
    });
    return apolloResult;
  } catch (pythonError) {
    logger.warn('[Apollo API] Python script not available, falling back to direct API call', { error: pythonError.message });
    
    // Fallback: Call Apollo API directly using axios
    try {
      const axios = require('axios');
      const apolloApiKey = process.env.APOLLO_API_KEY || process.env.APOLLO_IO_API_KEY;
      
      // Build Apollo API request
      const apolloRequestData = {
        api_key: apolloApiKey,
        per_page: apolloPerPage,
        page: page || 1
      };
      
      // Add filters
      if (person_titles && person_titles.length > 0) {
        apolloRequestData.person_titles = person_titles;
      }
      if (organization_locations && organization_locations.length > 0) {
        apolloRequestData.organization_locations = organization_locations;
      }
      if (organization_industries && organization_industries.length > 0) {
        apolloRequestData.organization_industries = organization_industries;
      }
      
      // LAD Architecture: Use environment variable for API base URL
      // Match Python script: https://api.apollo.io/api/v1 (includes /api/ in path)
      // Normalize base URL to ensure it has /api/ in the path
      let apolloBaseUrl = process.env.APOLLO_API_BASE_URL || 'https://api.apollo.io/api/v1';
      
      // Fix common issue: if base URL is https://api.apollo.io/v2, convert to https://api.apollo.io/api/v2
      if (apolloBaseUrl.includes('api.apollo.io') && !apolloBaseUrl.includes('/api/')) {
        apolloBaseUrl = apolloBaseUrl.replace('api.apollo.io', 'api.apollo.io/api');
      }
      
      const apolloSearchEndpoint = `${apolloBaseUrl}/mixed_people/search`;
      
      logger.info('[Apollo API] Calling Apollo API directly', {
        endpoint: apolloSearchEndpoint,
        requestData: {
          ...apolloRequestData,
          api_key: '***HIDDEN***'
        }
      });
      
      const apolloResponse = await axios.post(
        apolloSearchEndpoint,
        apolloRequestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          timeout: 120000
        }
      );
      
      logger.info('[Apollo API] Apollo API responded', { status: apolloResponse.status });
      
      if (apolloResponse.data && apolloResponse.data.people) {
        const people = apolloResponse.data.people;
        logger.info('[Apollo API] Found people from Apollo', { count: people.length });
        
        return {
          success: true,
          employees: people,
          pagination: apolloResponse.data.pagination || {}
        };
      } else {
        logger.warn('[Apollo API] Apollo API returned unexpected format', { data: apolloResponse.data });
        return {
          success: false,
          employees: [],
          error: 'Unexpected response format from Apollo API'
        };
      }
    } catch (apiError) {
      logger.error('[Apollo API] Error calling Apollo API directly', {
        message: apiError.message,
        status: apiError.response?.status,
        responseData: apiError.response?.data
      });
      throw apiError;
    }
  }
}

module.exports = {
  callApolloService,
  callApolloApi,
  searchEmployeesFromApollo
};

