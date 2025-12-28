/**
 * Apollo Leads Feature - API Functions
 * 
 * All HTTP API calls for the Apollo Leads feature.
 * LAD Architecture Compliant - Uses shared apiClient instead of direct fetch()
 */

// Try to use shared apiClient if available, otherwise create a simple wrapper
let apiClient: any;

try {
  // Try to import from shared location (when integrated into LAD)
  apiClient = require('../../shared/apiClient').apiClient;
} catch (error) {
  // Fallback: Create simple apiClient for standalone feature repo
  apiClient = {
    get: async (url: string, options?: any) => {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        ...options
      });
      return { data: await response.json() };
    },
    post: async (url: string, data?: any, options?: any) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(data),
        ...options
      });
      return { data: await response.json() };
    }
  };
}

/**
 * Get authentication headers
 */
function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

import type {
  ApolloSearchParams,
  ApolloSearchResponse,
  ApolloEmployeeSearchParams,
  ApolloEmployeeSearchResponse,
  ApolloCompany,
  ApolloHealthResponse
} from './types/apollo.types';

const API_BASE = '/api/apollo-leads';

/**
 * Search for companies using Apollo.io
 */
export async function searchCompanies(params: ApolloSearchParams): Promise<ApolloSearchResponse> {
  const response = await apiClient.post<{ data: ApolloSearchResponse }>(
    `${API_BASE}/search`,
    {
      query: params.query || params.keywords?.join(' '),
      location: params.location,
      industry: params.industry,
      employee_count_min: params.employee_count_min,
      employee_count_max: params.employee_count_max,
      revenue_min: params.revenue_min,
      revenue_max: params.revenue_max,
      technologies: params.technologies,
      limit: params.limit || 50,
      offset: params.offset || 0
    }
  );
  return response.data.data;
}

/**
 * Get detailed company information
 */
export async function getCompanyDetails(companyId: string): Promise<ApolloCompany> {
  const response = await apiClient.get<{ data: ApolloCompany }>(
    `${API_BASE}/companies/${companyId}`
  );
  return response.data.data;
}

/**
 * Search for employees from database cache
 * Falls back to Apollo API if no results found
 */
export async function searchEmployeesFromDb(params: ApolloEmployeeSearchParams): Promise<ApolloEmployeeSearchResponse> {
  const response = await apiClient.post<{ data: ApolloEmployeeSearchResponse }>(
    `${API_BASE}/search-employees-from-db`,
    {
      organization_locations: params.organization_locations || [],
      person_titles: params.person_titles || [],
      organization_industries: params.organization_industries || [],
      per_page: params.per_page || 100,
      page: params.page || 1
    }
  );
  return response.data.data || response.data;
}

/**
 * Search for employees at a company
 */
export async function searchEmployees(params: ApolloEmployeeSearchParams): Promise<ApolloEmployeeSearchResponse> {
  const response = await apiClient.post<{ data: ApolloEmployeeSearchResponse }>(
    `${API_BASE}/employees/search`,
    {
      company_id: params.company_id,
      company_name: params.company_name,
      titles: params.titles,
      seniority: params.seniority,
      departments: params.departments,
      location: params.location,
      limit: params.limit || 50
    }
  );
  return response.data.data;
}

/**
 * Reveal email for a person (costs 1 credit)
 * Supports both GET (with personId in URL) and POST (with person_id in body)
 */
export async function revealEmail(personId: string, employeeName?: string): Promise<{ success: boolean; email?: string; from_cache?: boolean; credits_used?: number; error?: string }> {
  const response = await apiClient.post<{ success: boolean; email?: string; from_cache?: boolean; credits_used?: number; error?: string }>(
    `${API_BASE}/reveal-email`,
    {
      person_id: personId,
      employee_name: employeeName
    }
  );
  return response.data;
}

/**
 * Reveal phone for a person (costs 8 credits)
 * Supports both GET (with personId in URL) and POST (with person_id in body)
 * Note: Phone reveals are asynchronous - phone may be null initially, delivered via webhook
 */
export async function revealPhone(personId: string, employeeName?: string): Promise<{ success: boolean; phone?: string | null; from_cache?: boolean; credits_used?: number; processing?: boolean; message?: string; error?: string }> {
  const response = await apiClient.post<{ success: boolean; phone?: string | null; from_cache?: boolean; credits_used?: number; processing?: boolean; message?: string; error?: string }>(
    `${API_BASE}/reveal-phone`,
    {
      person_id: personId,
      employee_name: employeeName
    }
  );
  return response.data;
}

/**
 * Health check for Apollo service
 */
export async function checkHealth(): Promise<ApolloHealthResponse> {
  const response = await apiClient.get<{ data: ApolloHealthResponse }>(
    `${API_BASE}/health`
  );
  return response.data.data;
}

