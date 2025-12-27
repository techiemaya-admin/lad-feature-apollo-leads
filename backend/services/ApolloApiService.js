/**
 * Apollo API Service
 * Handles Apollo API calls and Python script execution
 */

const axios = require('axios');
const path = require('path');
const { spawn, execSync } = require('child_process');

/**
 * Helper function to call Python Apollo service (like pluto_campaigns)
 * Falls back to API endpoint if Python script is not available
 */
function callApolloService(method, params = {}) {
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
    
    console.log(`[Apollo API] 🐍 Using Python executable: ${pythonExec}`);
    console.log(`[Apollo API] 📜 Using script: ${scriptPath}`);
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
      console.log('[Apollo API] [Python]', errorText.trim());
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
          console.error('[Apollo API] JSON Parse Error:', e.message);
          console.error('[Apollo API] Output (first 500 chars):', output.substring(0, 500));
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
  const PRODUCTION_BACKEND_URL = process.env.BACKEND_URL || 
                                 process.env.NEXT_PUBLIC_BACKEND_URL || 
                                 'https://lad-backend-develop-741719885039.us-central1.run.app';
  
  console.log(`[Apollo API] 🌐 Calling Apollo API via: ${PRODUCTION_BACKEND_URL}/api/apollo-leads/search-employees`);
  
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
  
  console.log('[Apollo API] 🐍 Attempting to call Apollo API...');
  console.log('[Apollo API] 📋 Search params:', JSON.stringify({
    organization_locations,
    person_titles,
    organization_industries,
    per_page: apolloPerPage,
    page
  }, null, 2));
  
  // Check if Apollo API key is configured
  const apiKey = process.env.APOLLO_API_KEY || process.env.APOLLO_IO_API_KEY;
  if (!apiKey) {
    console.error('[Apollo API] ❌ Apollo API key not configured!');
    console.error('[Apollo API] Set APOLLO_API_KEY or APOLLO_IO_API_KEY in .env file');
    throw new Error('Apollo API key not configured');
  }
  console.log('[Apollo API] ✅ API key found');
  
  try {
    console.log('[Apollo API] 🐍 Attempting to call Apollo via Python script...');
    const apolloResult = await callApolloService('search_people_direct', {
      organization_locations: organization_locations,
      person_titles: person_titles,
      organization_industries: organization_industries,
      per_page: apolloPerPage,
      page: page || 1
    });
    console.log('[Apollo API] ✅ Successfully called Apollo via Python script');
    console.log('[Apollo API] 📊 Result:', apolloResult?.success ? `Found ${apolloResult?.employees?.length || 0} employees` : 'No result');
    return apolloResult;
  } catch (pythonError) {
    console.log(`[Apollo API] ⚠️  Python script not available: ${pythonError.message}`);
    console.log('[Apollo API] 🌐 Falling back to direct Apollo API call...');
    
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
      
      console.log('[Apollo API] 🌐 Calling Apollo API directly: https://api.apollo.io/v1/mixed_people/search');
      console.log('[Apollo API] 📋 Request data:', JSON.stringify({
        ...apolloRequestData,
        api_key: '***HIDDEN***'
      }, null, 2));
      
      const apolloResponse = await axios.post(
        'https://api.apollo.io/v1/mixed_people/search',
        apolloRequestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          timeout: 120000
        }
      );
      
      console.log('[Apollo API] ✅ Apollo API responded with status:', apolloResponse.status);
      
      if (apolloResponse.data && apolloResponse.data.people) {
        const people = apolloResponse.data.people;
        console.log(`[Apollo API] 📊 Found ${people.length} people from Apollo`);
        
        return {
          success: true,
          employees: people,
          pagination: apolloResponse.data.pagination || {}
        };
      } else {
        console.warn('[Apollo API] ⚠️  Apollo API returned unexpected format:', apolloResponse.data);
        return {
          success: false,
          employees: [],
          error: 'Unexpected response format from Apollo API'
        };
      }
    } catch (apiError) {
      console.error('[Apollo API] ❌ Error calling Apollo API directly:', apiError.message);
      if (apiError.response) {
        console.error('[Apollo API] Response status:', apiError.response.status);
        console.error('[Apollo API] Response data:', JSON.stringify(apiError.response.data, null, 2));
      }
      throw apiError;
    }
  }
}

module.exports = {
  callApolloService,
  callApolloApi,
  searchEmployeesFromApollo
};

