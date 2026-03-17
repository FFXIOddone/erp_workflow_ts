/**
 * Breadcrumb State Persistence
 * 
 * Persists breadcrumb state across sessions:
 * - Navigation history with timestamps
 * - Frequently visited paths
 * - Custom breadcrumb labels
 * - User preferences
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { BreadcrumbItem } from '../components/EnhancedBreadcrumbs';

// ============================================================================
// Types
// ============================================================================

export interface NavigationHistoryEntry {
  path: string;
  label: string;
  timestamp: number;
  duration?: number; // Time spent on page in ms
}

export interface PathFrequency {
  path: string;
  visitCount: number;
  lastVisit: number;
  averageDuration: number;
}

export interface CustomLabel {
  path: string;
  label: string;
  createdAt: number;
}

export interface BreadcrumbPreferences {
  maxVisible: number;
  showHomeIcon: boolean;
  showHistoryButtons: boolean;
  collapsedBehavior: 'dropdown' | 'ellipsis';
  animationsEnabled: boolean;
}

export interface BreadcrumbPersistenceState {
  history: NavigationHistoryEntry[];
  frequencies: PathFrequency[];
  customLabels: CustomLabel[];
  preferences: BreadcrumbPreferences;
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEY = 'erp-breadcrumb-state';
const MAX_HISTORY_ENTRIES = 100;
const FREQUENCY_DECAY_DAYS = 30;

// ============================================================================
// Default Values
// ============================================================================

const defaultPreferences: BreadcrumbPreferences = {
  maxVisible: 4,
  showHomeIcon: true,
  showHistoryButtons: false,
  collapsedBehavior: 'dropdown',
  animationsEnabled: true,
};

const defaultState: BreadcrumbPersistenceState = {
  history: [],
  frequencies: [],
  customLabels: [],
  preferences: defaultPreferences,
};

// ============================================================================
// Persistence Hook
// ============================================================================

export function useBreadcrumbPersistence() {
  const [state, setState] = useState<BreadcrumbPersistenceState>(defaultState);
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastPath, setLastPath] = useState<string | null>(null);
  const [pathStartTime, setPathStartTime] = useState<number | null>(null);

  // Load from storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setState({
          ...defaultState,
          ...parsed,
          preferences: { ...defaultPreferences, ...parsed.preferences },
        });
      }
    } catch (e) {
      console.error('Failed to load breadcrumb state:', e);
    }
    setIsLoaded(true);
  }, []);

  // Persist to storage on change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.error('Failed to save breadcrumb state:', e);
      }
    }
  }, [state, isLoaded]);

  // Record navigation
  const recordNavigation = useCallback(
    (path: string, label: string) => {
      const now = Date.now();

      // Calculate duration for previous path
      let duration: number | undefined;
      if (lastPath && pathStartTime) {
        duration = now - pathStartTime;
      }

      // Update last path tracking
      setLastPath(path);
      setPathStartTime(now);

      setState((prev) => {
        // Update history (add new entry, update previous with duration)
        const updatedHistory = [...prev.history];
        
        // Update duration of last entry
        if (duration && updatedHistory.length > 0) {
          const lastEntry = updatedHistory[updatedHistory.length - 1];
          if (lastEntry.path === lastPath) {
            lastEntry.duration = duration;
          }
        }

        // Add new entry
        updatedHistory.push({
          path,
          label,
          timestamp: now,
        });

        // Trim to max entries
        const trimmedHistory = updatedHistory.slice(-MAX_HISTORY_ENTRIES);

        // Update frequencies
        const existingFreq = prev.frequencies.find((f) => f.path === path);
        let updatedFrequencies: PathFrequency[];

        if (existingFreq) {
          updatedFrequencies = prev.frequencies.map((f) => {
            if (f.path === path) {
              return {
                ...f,
                visitCount: f.visitCount + 1,
                lastVisit: now,
                averageDuration:
                  duration !== undefined
                    ? (f.averageDuration * f.visitCount + duration) / (f.visitCount + 1)
                    : f.averageDuration,
              };
            }
            return f;
          });
        } else {
          updatedFrequencies = [
            ...prev.frequencies,
            {
              path,
              visitCount: 1,
              lastVisit: now,
              averageDuration: duration ?? 0,
            },
          ];
        }

        return {
          ...prev,
          history: trimmedHistory,
          frequencies: updatedFrequencies,
        };
      });
    },
    [lastPath, pathStartTime]
  );

  // Set custom label for a path
  const setCustomLabel = useCallback((path: string, label: string) => {
    setState((prev) => {
      const existing = prev.customLabels.findIndex((l) => l.path === path);
      let updatedLabels: CustomLabel[];

      if (existing >= 0) {
        updatedLabels = prev.customLabels.map((l, i) =>
          i === existing ? { ...l, label } : l
        );
      } else {
        updatedLabels = [
          ...prev.customLabels,
          { path, label, createdAt: Date.now() },
        ];
      }

      return { ...prev, customLabels: updatedLabels };
    });
  }, []);

  // Remove custom label
  const removeCustomLabel = useCallback((path: string) => {
    setState((prev) => ({
      ...prev,
      customLabels: prev.customLabels.filter((l) => l.path !== path),
    }));
  }, []);

  // Get custom label for a path
  const getCustomLabel = useCallback(
    (path: string): string | undefined => {
      return state.customLabels.find((l) => l.path === path)?.label;
    },
    [state.customLabels]
  );

  // Update preferences
  const updatePreferences = useCallback(
    (updates: Partial<BreadcrumbPreferences>) => {
      setState((prev) => ({
        ...prev,
        preferences: { ...prev.preferences, ...updates },
      }));
    },
    []
  );

  // Get frequently visited paths (with decay)
  const frequentPaths = useMemo(() => {
    const now = Date.now();
    const decayPeriod = FREQUENCY_DECAY_DAYS * 24 * 60 * 60 * 1000;

    return state.frequencies
      .map((f) => {
        // Apply time decay to visit count
        const age = now - f.lastVisit;
        const decayFactor = Math.max(0, 1 - age / decayPeriod);
        return {
          ...f,
          score: f.visitCount * decayFactor,
        };
      })
      .filter((f) => f.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [state.frequencies]);

  // Get recent navigation history
  const recentHistory = useMemo(() => {
    return state.history.slice(-20).reverse();
  }, [state.history]);

  // Navigate back in history
  const goBack = useCallback(
    (steps: number = 1): string | null => {
      const index = state.history.length - 1 - steps;
      if (index >= 0 && index < state.history.length) {
        return state.history[index].path;
      }
      return null;
    },
    [state.history]
  );

  // Clear history
  const clearHistory = useCallback(() => {
    setState((prev) => ({
      ...prev,
      history: [],
      frequencies: [],
    }));
  }, []);

  return {
    // State
    history: state.history,
    frequencies: state.frequencies,
    customLabels: state.customLabels,
    preferences: state.preferences,
    isLoaded,

    // Derived
    frequentPaths,
    recentHistory,

    // Actions
    recordNavigation,
    setCustomLabel,
    removeCustomLabel,
    getCustomLabel,
    updatePreferences,
    goBack,
    clearHistory,
  };
}

// ============================================================================
// Integration Hook - Combines with Route
// ============================================================================

interface UseBreadcrumbsWithPersistenceOptions {
  /** Current route path */
  currentPath: string;
  
  /** Current route label */
  currentLabel: string;
  
  /** Route configuration for building breadcrumbs */
  routes?: Array<{
    path: string;
    label: string;
    parent?: string;
  }>;
  
  /** Custom label getter (e.g., for entity names) */
  getLabel?: (path: string) => string | Promise<string>;
}

export function useBreadcrumbsWithPersistence({
  currentPath,
  currentLabel,
  routes = [],
  getLabel,
}: UseBreadcrumbsWithPersistenceOptions) {
  const {
    recordNavigation,
    getCustomLabel,
    preferences,
    frequentPaths,
    recentHistory,
  } = useBreadcrumbPersistence();

  // Record navigation when path changes
  useEffect(() => {
    recordNavigation(currentPath, currentLabel);
  }, [currentPath, currentLabel, recordNavigation]);

  // Build breadcrumb items from route
  const items = useMemo<BreadcrumbItem[]>(() => {
    const result: BreadcrumbItem[] = [];
    let path = currentPath;

    // Find matching route and traverse up
    while (path) {
      const route = routes.find((r) => {
        // Simple path matching (handles :params)
        const routeParts = r.path.split('/');
        const pathParts = path.split('/');
        
        if (routeParts.length !== pathParts.length) return false;
        
        return routeParts.every((part, i) => 
          part.startsWith(':') || part === pathParts[i]
        );
      });

      if (route) {
        // Check for custom label
        const customLabel = getCustomLabel(path);
        
        result.unshift({
          id: path,
          label: customLabel ?? route.label,
          path,
          active: path === currentPath,
        });

        path = route.parent ?? '';
      } else {
        break;
      }
    }

    return result;
  }, [currentPath, routes, getCustomLabel]);

  return {
    items,
    preferences,
    frequentPaths,
    recentHistory,
  };
}

// ============================================================================
// Smart Suggestions Hook
// ============================================================================

export function useBreadcrumbSuggestions(currentPath: string) {
  const { frequentPaths, recentHistory } = useBreadcrumbPersistence();

  // Get suggested next pages based on patterns
  const suggestions = useMemo(() => {
    const pathSegments = currentPath.split('/').filter(Boolean);
    const suggestions: Array<{ path: string; label: string; reason: string }> = [];

    // Add frequently visited paths
    for (const freq of frequentPaths.slice(0, 3)) {
      if (freq.path !== currentPath) {
        suggestions.push({
          path: freq.path,
          label: freq.path.split('/').pop() || freq.path,
          reason: 'Frequently visited',
        });
      }
    }

    // Add sibling paths from history
    const siblings = new Map<string, number>();
    for (const entry of recentHistory) {
      const entrySegments = entry.path.split('/').filter(Boolean);
      
      // Check if same parent
      if (
        entrySegments.length === pathSegments.length &&
        entrySegments.slice(0, -1).join('/') === pathSegments.slice(0, -1).join('/') &&
        entry.path !== currentPath
      ) {
        siblings.set(entry.path, (siblings.get(entry.path) || 0) + 1);
      }
    }

    for (const [path, count] of Array.from(siblings.entries()).slice(0, 2)) {
      if (!suggestions.some((s) => s.path === path)) {
        suggestions.push({
          path,
          label: path.split('/').pop() || path,
          reason: 'Related page',
        });
      }
    }

    return suggestions.slice(0, 5);
  }, [currentPath, frequentPaths, recentHistory]);

  return suggestions;
}

export default useBreadcrumbPersistence;
