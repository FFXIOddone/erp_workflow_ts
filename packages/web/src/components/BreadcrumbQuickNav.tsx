/**
 * Breadcrumb Quick Navigation
 * 
 * Command palette-style quick navigation from breadcrumbs:
 * - Fuzzy search through all navigable pages
 * - Recent pages list
 * - Pinned/favorite pages
 * - Keyboard shortcuts
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Clock,
  Star,
  ArrowRight,
  Command,
  Hash,
  X,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

export interface NavigationPage {
  id: string;
  path: string;
  label: string;
  description?: string;
  icon?: React.ElementType;
  category?: string;
  keywords?: string[];
  data?: Record<string, unknown>;
}

export interface RecentPage extends NavigationPage {
  visitedAt: Date;
  visitCount: number;
}

export interface PinnedPage extends NavigationPage {
  pinnedAt: Date;
  order: number;
}

export interface QuickNavContextValue {
  pages: NavigationPage[];
  recentPages: RecentPage[];
  pinnedPages: PinnedPage[];
  isOpen: boolean;
  openQuickNav: () => void;
  closeQuickNav: () => void;
  toggleQuickNav: () => void;
  registerPage: (page: NavigationPage) => void;
  unregisterPage: (id: string) => void;
  recordVisit: (pageId: string) => void;
  pinPage: (pageId: string) => void;
  unpinPage: (pageId: string) => void;
  isPinned: (pageId: string) => boolean;
  navigate: (path: string) => void;
}

// ============================================================================
// Context
// ============================================================================

const QuickNavContext = createContext<QuickNavContextValue | null>(null);

export function useQuickNav() {
  const context = useContext(QuickNavContext);
  if (!context) {
    throw new Error('useQuickNav must be used within QuickNavProvider');
  }
  return context;
}

// ============================================================================
// Storage Keys
// ============================================================================

const RECENT_PAGES_KEY = 'erp-quick-nav-recent';
const PINNED_PAGES_KEY = 'erp-quick-nav-pinned';
const MAX_RECENT_PAGES = 10;

// ============================================================================
// Provider
// ============================================================================

interface QuickNavProviderProps {
  children: ReactNode;
  pages?: NavigationPage[];
  onNavigate?: (path: string) => void;
}

export function QuickNavProvider({
  children,
  pages: initialPages = [],
  onNavigate,
}: QuickNavProviderProps) {
  const [pages, setPages] = useState<NavigationPage[]>(initialPages);
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);
  const [pinnedPages, setPinnedPages] = useState<PinnedPage[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    try {
      const recentData = localStorage.getItem(RECENT_PAGES_KEY);
      if (recentData) {
        const parsed = JSON.parse(recentData);
        setRecentPages(
          parsed.map((p: RecentPage) => ({
            ...p,
            visitedAt: new Date(p.visitedAt),
          }))
        );
      }

      const pinnedData = localStorage.getItem(PINNED_PAGES_KEY);
      if (pinnedData) {
        const parsed = JSON.parse(pinnedData);
        setPinnedPages(
          parsed.map((p: PinnedPage) => ({
            ...p,
            pinnedAt: new Date(p.pinnedAt),
          }))
        );
      }
    } catch (e) {
      console.error('Failed to load quick nav data:', e);
    }
  }, []);

  // Persist to storage
  useEffect(() => {
    localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(recentPages));
  }, [recentPages]);

  useEffect(() => {
    localStorage.setItem(PINNED_PAGES_KEY, JSON.stringify(pinnedPages));
  }, [pinnedPages]);

  // Keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const openQuickNav = useCallback(() => setIsOpen(true), []);
  const closeQuickNav = useCallback(() => setIsOpen(false), []);
  const toggleQuickNav = useCallback(() => setIsOpen((prev) => !prev), []);

  const registerPage = useCallback((page: NavigationPage) => {
    setPages((prev) => {
      const existing = prev.findIndex((p) => p.id === page.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = page;
        return updated;
      }
      return [...prev, page];
    });
  }, []);

  const unregisterPage = useCallback((id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const recordVisit = useCallback(
    (pageId: string) => {
      const page = pages.find((p) => p.id === pageId);
      if (!page) return;

      setRecentPages((prev) => {
        const existing = prev.find((p) => p.id === pageId);
        const updated: RecentPage = existing
          ? {
              ...existing,
              visitedAt: new Date(),
              visitCount: existing.visitCount + 1,
            }
          : {
              ...page,
              visitedAt: new Date(),
              visitCount: 1,
            };

        const filtered = prev.filter((p) => p.id !== pageId);
        return [updated, ...filtered].slice(0, MAX_RECENT_PAGES);
      });
    },
    [pages]
  );

  const pinPage = useCallback(
    (pageId: string) => {
      const page = pages.find((p) => p.id === pageId);
      if (!page) return;

      setPinnedPages((prev) => {
        if (prev.some((p) => p.id === pageId)) return prev;
        return [
          ...prev,
          {
            ...page,
            pinnedAt: new Date(),
            order: prev.length,
          },
        ];
      });
    },
    [pages]
  );

  const unpinPage = useCallback((pageId: string) => {
    setPinnedPages((prev) => prev.filter((p) => p.id !== pageId));
  }, []);

  const isPinned = useCallback(
    (pageId: string) => pinnedPages.some((p) => p.id === pageId),
    [pinnedPages]
  );

  const navigate = useCallback(
    (path: string) => {
      setIsOpen(false);
      if (onNavigate) {
        onNavigate(path);
      } else {
        window.location.href = path;
      }
    },
    [onNavigate]
  );

  const contextValue = useMemo<QuickNavContextValue>(
    () => ({
      pages,
      recentPages,
      pinnedPages,
      isOpen,
      openQuickNav,
      closeQuickNav,
      toggleQuickNav,
      registerPage,
      unregisterPage,
      recordVisit,
      pinPage,
      unpinPage,
      isPinned,
      navigate,
    }),
    [
      pages,
      recentPages,
      pinnedPages,
      isOpen,
      openQuickNav,
      closeQuickNav,
      toggleQuickNav,
      registerPage,
      unregisterPage,
      recordVisit,
      pinPage,
      unpinPage,
      isPinned,
      navigate,
    ]
  );

  return (
    <QuickNavContext.Provider value={contextValue}>
      {children}
      <QuickNavDialog />
    </QuickNavContext.Provider>
  );
}

// ============================================================================
// Quick Nav Dialog
// ============================================================================

function QuickNavDialog() {
  const {
    pages,
    recentPages,
    pinnedPages,
    isOpen,
    closeQuickNav,
    pinPage,
    unpinPage,
    isPinned,
    navigate,
  } = useQuickNav();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Fuzzy search
  const filteredPages = useMemo(() => {
    if (!query) return [];

    const lowerQuery = query.toLowerCase();
    const queryTerms = lowerQuery.split(/\s+/).filter(Boolean);

    return pages
      .map((page) => {
        const searchText = [
          page.label,
          page.description,
          page.category,
          ...(page.keywords || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        // Score based on how many terms match and where
        let score = 0;
        for (const term of queryTerms) {
          if (page.label.toLowerCase().includes(term)) score += 10;
          if (page.label.toLowerCase().startsWith(term)) score += 5;
          if (page.description?.toLowerCase().includes(term)) score += 3;
          if (page.keywords?.some((k) => k.toLowerCase().includes(term))) score += 2;
          if (searchText.includes(term)) score += 1;
        }

        return { page, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.page);
  }, [pages, query]);

  // Combined results
  const results = useMemo(() => {
    const sections: { title: string; pages: NavigationPage[]; type: 'pinned' | 'recent' | 'search' }[] = [];

    if (query) {
      if (filteredPages.length > 0) {
        sections.push({ title: 'Search Results', pages: filteredPages, type: 'search' });
      }
    } else {
      if (pinnedPages.length > 0) {
        sections.push({ title: 'Pinned', pages: pinnedPages, type: 'pinned' });
      }
      if (recentPages.length > 0) {
        sections.push({ title: 'Recent', pages: recentPages, type: 'recent' });
      }
    }

    return sections;
  }, [query, filteredPages, pinnedPages, recentPages]);

  // Flatten for keyboard navigation
  const flatResults = useMemo(
    () => results.flatMap((section) => section.pages),
    [results]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < flatResults.length - 1 ? prev + 1 : prev
          );
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;

        case 'Enter':
          e.preventDefault();
          if (flatResults[selectedIndex]) {
            navigate(flatResults[selectedIndex].path);
          }
          break;

        case 'Tab':
          // Pin/unpin with Tab
          e.preventDefault();
          if (flatResults[selectedIndex]) {
            const pageId = flatResults[selectedIndex].id;
            if (isPinned(pageId)) {
              unpinPage(pageId);
            } else {
              pinPage(pageId);
            }
          }
          break;
      }
    },
    [flatResults, selectedIndex, navigate, isPinned, pinPage, unpinPage]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedItem = listRef.current.querySelector('[data-selected="true"]');
      selectedItem?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Track which index we're at across sections
  let globalIndex = 0;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
        onClick={closeQuickNav}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          onClick={(e) => e.stopPropagation()}
          className={clsx(
            'relative w-full max-w-xl',
            'bg-white dark:bg-gray-800',
            'rounded-xl shadow-2xl',
            'border border-gray-200 dark:border-gray-700',
            'overflow-hidden'
          )}
        >
          {/* Search Input */}
          <div className="flex items-center border-b border-gray-200 dark:border-gray-700">
            <Search className="h-5 w-5 text-gray-400 ml-4" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search pages..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className={clsx(
                'flex-1 px-4 py-4',
                'text-gray-900 dark:text-white',
                'placeholder-gray-500 dark:placeholder-gray-400',
                'bg-transparent border-none outline-none',
                'text-lg'
              )}
            />
            <div className="px-4 flex items-center gap-2">
              <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 rounded">
                <Command className="h-3 w-3" />K
              </kbd>
              <button
                onClick={closeQuickNav}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Results */}
          <div
            ref={listRef}
            className="max-h-[60vh] overflow-auto p-2"
          >
            {results.length === 0 && query && (
              <div className="py-8 text-center text-gray-500">
                <Hash className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No pages found for "{query}"</p>
              </div>
            )}

            {results.length === 0 && !query && (
              <div className="py-8 text-center text-gray-500">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No recent pages</p>
                <p className="text-sm mt-1">Start typing to search</p>
              </div>
            )}

            {results.map((section) => (
              <div key={section.title} className="mb-4">
                <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {section.type === 'pinned' && <Star className="h-3 w-3" />}
                  {section.type === 'recent' && <Clock className="h-3 w-3" />}
                  {section.title}
                </div>

                {section.pages.map((page) => {
                  const currentIndex = globalIndex++;
                  const isSelected = currentIndex === selectedIndex;
                  const pageIsPinned = isPinned(page.id);
                  const Icon = page.icon ?? Hash;

                  return (
                    <div
                      key={page.id}
                      data-selected={isSelected}
                      onClick={() => navigate(page.path)}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={clsx(
                        'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer',
                        'transition-colors group',
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      )}
                    >
                      <Icon
                        className={clsx(
                          'h-5 w-5',
                          isSelected
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-400'
                        )}
                      />

                      <div className="flex-1 min-w-0">
                        <div
                          className={clsx(
                            'text-sm font-medium truncate',
                            isSelected
                              ? 'text-blue-900 dark:text-blue-100'
                              : 'text-gray-900 dark:text-white'
                          )}
                        >
                          {page.label}
                        </div>
                        {page.description && (
                          <div className="text-xs text-gray-500 truncate">
                            {page.description}
                          </div>
                        )}
                      </div>

                      {/* Pin button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (pageIsPinned) {
                            unpinPage(page.id);
                          } else {
                            pinPage(page.id);
                          }
                        }}
                        className={clsx(
                          'p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
                          pageIsPinned
                            ? 'text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/20'
                            : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        )}
                        title={pageIsPinned ? 'Unpin' : 'Pin'}
                      >
                        <Star
                          className="h-4 w-4"
                          fill={pageIsPinned ? 'currentColor' : 'none'}
                        />
                      </button>

                      {isSelected && (
                        <ArrowRight className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↵</kbd>
              Open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">Tab</kbd>
              Pin
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">Esc</kbd>
              Close
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// Quick Nav Trigger Button
// ============================================================================

interface QuickNavTriggerProps {
  className?: string;
}

export function QuickNavTrigger({ className }: QuickNavTriggerProps) {
  const { openQuickNav } = useQuickNav();

  return (
    <button
      onClick={openQuickNav}
      className={clsx(
        'flex items-center gap-2 px-3 py-1.5',
        'text-sm text-gray-500 dark:text-gray-400',
        'bg-gray-100 dark:bg-gray-700',
        'rounded-lg border border-gray-200 dark:border-gray-600',
        'hover:bg-gray-200 dark:hover:bg-gray-600',
        'transition-colors',
        className
      )}
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Quick Navigation</span>
      <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
        <Command className="h-3 w-3" />K
      </kbd>
    </button>
  );
}

// ============================================================================
// Default Pages Registry
// ============================================================================

export const defaultERPPages: NavigationPage[] = [
  {
    id: 'dashboard',
    path: '/',
    label: 'Dashboard',
    description: 'Overview and quick stats',
    category: 'Main',
    keywords: ['home', 'main', 'overview'],
  },
  {
    id: 'orders',
    path: '/orders',
    label: 'Work Orders',
    description: 'View and manage work orders',
    category: 'Orders',
    keywords: ['jobs', 'work', 'production'],
  },
  {
    id: 'orders-new',
    path: '/orders/new',
    label: 'Create Work Order',
    description: 'Create a new work order',
    category: 'Orders',
    keywords: ['new', 'add', 'create', 'job'],
  },
  {
    id: 'inventory',
    path: '/inventory',
    label: 'Inventory',
    description: 'Manage inventory items',
    category: 'Inventory',
    keywords: ['stock', 'materials', 'supplies'],
  },
  {
    id: 'schedule',
    path: '/schedule',
    label: 'Schedule',
    description: 'Production schedule and calendar',
    category: 'Production',
    keywords: ['calendar', 'timeline', 'planning'],
  },
  {
    id: 'customers',
    path: '/customers',
    label: 'Customers',
    description: 'Customer management',
    category: 'CRM',
    keywords: ['clients', 'contacts', 'accounts'],
  },
  {
    id: 'reports',
    path: '/reports',
    label: 'Reports',
    description: 'Analytics and reports',
    category: 'Analytics',
    keywords: ['analytics', 'stats', 'metrics'],
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    description: 'System configuration',
    category: 'Admin',
    keywords: ['config', 'preferences', 'options'],
  },
];

export default QuickNavDialog;
