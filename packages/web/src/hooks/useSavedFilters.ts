import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'erp_saved_order_filters';

export interface OrderFilterState {
  search: string;
  statusFilter: string;
  dateFilter: string;
  priorityFilter: number[];
  stationFilter: string;
  assignedToFilter: string;
  hasAttachments: boolean | undefined;
  dueDateFrom: string;
  dueDateTo: string;
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: OrderFilterState;
  createdAt: string;
  isDefault?: boolean;
}

export function useSavedFilters() {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

  // Load saved filters from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSavedFilters(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load saved filters:', error);
    }
  }, []);

  // Persist to localStorage whenever savedFilters changes
  const persist = useCallback((filters: SavedFilter[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.error('Failed to save filters to localStorage:', error);
    }
  }, []);

  // Save a new filter preset
  const saveFilter = useCallback((name: string, filters: OrderFilterState) => {
    const newFilter: SavedFilter = {
      id: crypto.randomUUID(),
      name,
      filters,
      createdAt: new Date().toISOString(),
      isDefault: false,
    };
    
    setSavedFilters(prev => {
      const updated = [...prev, newFilter];
      persist(updated);
      return updated;
    });
    
    return newFilter;
  }, [persist]);

  // Update an existing filter preset
  const updateFilter = useCallback((id: string, updates: Partial<Omit<SavedFilter, 'id' | 'createdAt'>>) => {
    setSavedFilters(prev => {
      const updated = prev.map(f => 
        f.id === id ? { ...f, ...updates } : f
      );
      persist(updated);
      return updated;
    });
  }, [persist]);

  // Delete a filter preset
  const deleteFilter = useCallback((id: string) => {
    setSavedFilters(prev => {
      const updated = prev.filter(f => f.id !== id);
      persist(updated);
      return updated;
    });
  }, [persist]);

  // Set a filter as the default
  const setDefaultFilter = useCallback((id: string | null) => {
    setSavedFilters(prev => {
      const updated = prev.map(f => ({
        ...f,
        isDefault: f.id === id,
      }));
      persist(updated);
      return updated;
    });
  }, [persist]);

  // Get the default filter
  const getDefaultFilter = useCallback(() => {
    return savedFilters.find(f => f.isDefault);
  }, [savedFilters]);

  // Check if current filters match a saved filter
  const findMatchingFilter = useCallback((currentFilters: OrderFilterState) => {
    return savedFilters.find(saved => 
      saved.filters.search === currentFilters.search &&
      saved.filters.statusFilter === currentFilters.statusFilter &&
      saved.filters.dateFilter === currentFilters.dateFilter &&
      JSON.stringify(saved.filters.priorityFilter) === JSON.stringify(currentFilters.priorityFilter) &&
      saved.filters.stationFilter === currentFilters.stationFilter &&
      saved.filters.assignedToFilter === currentFilters.assignedToFilter &&
      saved.filters.hasAttachments === currentFilters.hasAttachments &&
      saved.filters.dueDateFrom === currentFilters.dueDateFrom &&
      saved.filters.dueDateTo === currentFilters.dueDateTo
    );
  }, [savedFilters]);

  return {
    savedFilters,
    saveFilter,
    updateFilter,
    deleteFilter,
    setDefaultFilter,
    getDefaultFilter,
    findMatchingFilter,
  };
}
