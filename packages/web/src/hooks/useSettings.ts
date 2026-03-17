import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

// Brand display names constant (defined locally to avoid module resolution issues)
const COMPANY_BRAND_DISPLAY_NAMES: Record<string, string> = {
  WILDE_SIGNS: 'Wilde Signs',
  PORT_CITY_SIGNS: 'Port City Signs',
};

interface SystemSettings {
  id: string;
  companyName: string;
  companyLogo: string | null;
  brandDisplayNames: Record<string, string> | null;
  // ... other settings
}

// Default brand display names (fallback if settings not loaded)
const DEFAULT_BRAND_NAMES: Record<string, string> = {
  WILDE_SIGNS: 'Wilde Signs',
  PORT_CITY_SIGNS: 'Port City Signs',
};

/**
 * Hook to get brand display names from system settings
 * Falls back to defaults if settings not available
 */
export function useBrandDisplayNames() {
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['settings', 'public'],
    queryFn: async () => {
      const response = await api.get('/settings/public');
      return response.data.data as Partial<SystemSettings>;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

  // Merge settings with defaults
  const brandNames: Record<string, string> = {
    ...DEFAULT_BRAND_NAMES,
    ...(settings?.brandDisplayNames ?? {}),
  };

  return {
    brandNames,
    isLoading,
    error,
    // Helper function to get display name for a brand
    getBrandName: (brandKey: string) => brandNames[brandKey] ?? COMPANY_BRAND_DISPLAY_NAMES[brandKey] ?? brandKey,
  };
}

/**
 * Hook to get full system settings (authenticated)
 */
export function useSettings() {
  const { data: settings, isLoading, error, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      return response.data.data as SystemSettings;
    },
    staleTime: 60 * 1000, // Cache for 1 minute
  });

  return {
    settings,
    isLoading,
    error,
    refetch,
    brandNames: {
      ...DEFAULT_BRAND_NAMES,
      ...(settings?.brandDisplayNames ?? {}),
    },
  };
}
