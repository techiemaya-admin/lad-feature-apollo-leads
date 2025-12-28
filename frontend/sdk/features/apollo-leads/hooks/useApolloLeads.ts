import { useState, useCallback } from 'react';
import { isFeatureEnabled } from '../../featureFlags';
import * as apolloApi from './api';

interface Company {
  id: string;
  name: string;
  website: string;
  industry: string;
  location: {
    city: string;
    state: string;
    country: string;
  };
  size: number;
  description: string;
  technologies: string[];
}

interface Lead {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  linkedin_url: string;
  company_name: string;
}

interface SearchFilters {
  keywords: string[];
  industry: string;
  location: string;
  company_size: string;
  revenue_range: string;
  technology: string;
}

export const useApolloLeads = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchCompanies = useCallback(async (
    keywords: string,
    filters: Partial<SearchFilters> = {},
    options: { limit?: number; page?: number } = {}
  ): Promise<Company[]> => {
    if (!isFeatureEnabled('apollo_leads')) {
      throw new Error('Apollo Leads feature is not enabled');
    }

    setLoading(true);
    setError(null);

    try {
      // LAD Architecture: Use api.ts instead of direct fetch
      return await apolloApi.searchCompanies({
        keywords: [keywords],
        ...filters,
        limit: options.limit || 50,
        offset: (options.page || 1 - 1) * (options.limit || 50)
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getCompanyDetails = useCallback(async (companyId: string): Promise<Company | null> => {
    if (!isFeatureEnabled('apollo_leads')) {
      throw new Error('Apollo Leads feature is not enabled');
    }

    setLoading(true);
    setError(null);

    try {
      // LAD Architecture: Use api.ts instead of direct fetch
      return await apolloApi.getCompanyDetails(companyId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getCompanyLeads = useCallback(async (
    companyId: string,
    options: { limit?: number; page?: number; title_filter?: string } = {}
  ): Promise<Lead[]> => {
    if (!isFeatureEnabled('apollo_leads')) {
      throw new Error('Apollo Leads feature is not enabled');
    }

    setLoading(true);
    setError(null);

    try {
      // LAD Architecture: Use api.ts instead of direct fetch
      return await apolloApi.searchEmployees({
        company_id: companyId,
        limit: options.limit || 25
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const revealEmail = useCallback(async (leadId: string): Promise<string | null> => {
    if (!isFeatureEnabled('apollo_leads')) {
      throw new Error('Apollo Leads feature is not enabled');
    }

    setLoading(true);
    setError(null);

    try {
      // LAD Architecture: Use api.ts instead of direct fetch
      return await apolloApi.revealEmail(leadId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const revealPhone = useCallback(async (leadId: string): Promise<string | null> => {
    if (!isFeatureEnabled('apollo_leads')) {
      throw new Error('Apollo Leads feature is not enabled');
    }

    setLoading(true);
    setError(null);

    try {
      // LAD Architecture: Use api.ts instead of direct fetch
      return await apolloApi.revealPhone(leadId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const bulkSearchCompanies = useCallback(async (searches: Partial<SearchFilters>[]): Promise<Company[][]> => {
    if (!isFeatureEnabled('apollo_leads')) {
      throw new Error('Apollo Leads feature is not enabled');
    }

    setLoading(true);
    setError(null);

    try {
      // LAD Architecture: Use api.ts instead of direct fetch
      // Note: Bulk search may need to be added to api.ts if not already present
      // For now, keeping direct call but should be moved to api.ts
      const response = await fetch('/api/apollo-leads/bulk-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ searches })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Bulk search failed');
      }

      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSearchHistory = useCallback(async (options: { limit?: number; page?: number } = []) => {
    if (!isFeatureEnabled('apollo_leads')) {
      throw new Error('Apollo Leads feature is not enabled');
    }

    setLoading(true);
    setError(null);

    try {
      // LAD Architecture: Use api.ts instead of direct fetch
      // Note: Search history may need to be added to api.ts if not already present
      // For now, keeping direct call but should be moved to api.ts
      const params = new URLSearchParams({
        limit: String(options.limit || 50),
        page: String(options.page || 1)
      });

      const response = await fetch(`/api/apollo-leads/search-history?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to get search history');
      }

      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // State
    loading,
    error,
    
    // Methods
    searchCompanies,
    getCompanyDetails,
    getCompanyLeads,
    revealEmail,
    revealPhone,
    bulkSearchCompanies,
    getSearchHistory,
    
    // Utilities
    clearError: () => setError(null)
  };
};