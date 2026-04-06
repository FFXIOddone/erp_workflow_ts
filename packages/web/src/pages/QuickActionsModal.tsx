import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Package,
  Users,
  FileText,
  LayoutDashboard,
  Settings,
  Plus,
  Clock,
  ListTodo,
  Printer,
  Map,
  FileBarChart,
  Activity,
  User,
  Calendar,
  ArrowLeftRight,
  Command
} from 'lucide-react';
import { filterBySearchFields } from '@erp/shared';
import { api } from '../lib/api';
import { useDebounce } from '../hooks/useDebounce';

interface QuickAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: 'navigation' | 'action' | 'search';
  path?: string;
  action?: () => void;
  keywords?: string[];
}

interface SearchResult {
  id: string;
  type: 'order' | 'customer' | 'quote' | 'inventory';
  label: string;
  description: string;
  path: string;
}

interface QuickSearchApiResult {
  id: string;
  entityType: 'workorder' | 'customer' | 'quote' | 'inventory';
  title: string;
  subtitle?: string;
  description?: string;
  url: string;
}

interface QuickActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Define available quick actions
const QUICK_ACTIONS: QuickAction[] = [
  // Navigation
  { id: 'nav-dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, category: 'navigation', path: '/', keywords: ['home', 'overview'] },
  { id: 'nav-orders', label: 'Orders', icon: <Package className="h-5 w-5" />, category: 'navigation', path: '/orders', keywords: ['work orders', 'jobs'] },
  { id: 'nav-customers', label: 'Customers', icon: <Users className="h-5 w-5" />, category: 'navigation', path: '/customers', keywords: ['clients'] },
  { id: 'nav-quotes', label: 'Quotes', icon: <FileText className="h-5 w-5" />, category: 'navigation', path: '/quotes', keywords: ['estimates', 'proposals'] },
  { id: 'nav-calendar', label: 'Calendar', icon: <Calendar className="h-5 w-5" />, category: 'navigation', path: '/calendar', keywords: ['schedule'] },
  { id: 'nav-print-queue', label: 'Print Queue', icon: <Printer className="h-5 w-5" />, category: 'navigation', path: '/rip-queue', keywords: ['production'] },
  { id: 'nav-installer', label: 'Installer Scheduling', icon: <Map className="h-5 w-5" />, category: 'navigation', path: '/installer-scheduling', keywords: ['dispatch', 'installation'] },
  { id: 'nav-reports', label: 'Reports', icon: <FileBarChart className="h-5 w-5" />, category: 'navigation', path: '/reports', keywords: ['analytics'] },
  { id: 'nav-activity', label: 'Activity Log', icon: <Activity className="h-5 w-5" />, category: 'navigation', path: '/activity', keywords: ['history', 'audit'] },
  { id: 'nav-my-activity', label: 'My Activity', icon: <User className="h-5 w-5" />, category: 'navigation', path: '/my-activity', keywords: ['personal'] },
  { id: 'nav-compare', label: 'Compare Orders', icon: <ArrowLeftRight className="h-5 w-5" />, category: 'navigation', path: '/orders/compare', keywords: ['diff'] },
  { id: 'nav-settings', label: 'Settings', icon: <Settings className="h-5 w-5" />, category: 'navigation', path: '/settings', keywords: ['preferences'] },
  
  // Actions
  { id: 'action-new-order', label: 'New Order', description: 'Create a new work order', icon: <Plus className="h-5 w-5" />, category: 'action', path: '/orders/new', keywords: ['create'] },
  { id: 'action-new-customer', label: 'New Customer', description: 'Add a new customer', icon: <Plus className="h-5 w-5" />, category: 'action', path: '/customers/new', keywords: ['create'] },
  { id: 'action-new-quote', label: 'New Quote', description: 'Create a new quote', icon: <Plus className="h-5 w-5" />, category: 'action', path: '/quotes/new', keywords: ['create'] },
];

export function QuickActionsModal({ isOpen, onClose }: QuickActionsModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debouncedQuery = useDebounce(query, 300);
  
  // Fetch search results when query has 2+ chars
  const { data: searchResults = [] } = useQuery<SearchResult[]>({
    queryKey: ['quick-search', debouncedQuery],
    queryFn: async () => {
      const response = await api.get('/search/quick', {
        params: { q: debouncedQuery, limit: 6 },
      });

      const results = Array.isArray(response.data?.data?.results)
        ? response.data.data.results
        : [];

      return results.map((result: QuickSearchApiResult): SearchResult => ({
        id: `${result.entityType}-${result.id}`,
        type: result.entityType === 'workorder' ? 'order' : result.entityType,
        label: result.title,
        description: result.description || result.subtitle || '',
        path: result.url,
      }));
    },
    enabled: debouncedQuery.length >= 2,
  });
  
  // Filter actions based on query
  const filteredActions = useMemo(() => {
    if (!query) return QUICK_ACTIONS;

    return filterBySearchFields(
      QUICK_ACTIONS,
      query,
      (action) => [
        action.label,
        action.description,
        ...(action.keywords || []),
      ],
    );
  }, [query]);
  
  // Combined results (actions + search results)
  const allResults = useMemo(() => {
    const combined: Array<{ type: 'action' | 'result'; item: QuickAction | SearchResult }> = [];
    
    filteredActions.forEach(action => {
      combined.push({ type: 'action', item: action });
    });
    
    searchResults.forEach((result) => {
      combined.push({ type: 'result', item: result });
    });
    
    return combined;
  }, [filteredActions, searchResults]);
  
  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [allResults]);
  
  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);
  
  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        const selected = allResults[selectedIndex];
        if (selected) {
          executeItem(selected);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, allResults, selectedIndex, onClose]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  const executeItem = (item: { type: 'action' | 'result'; item: QuickAction | SearchResult }) => {
    if (item.type === 'action') {
      const action = item.item as QuickAction;
      if (action.path) {
        navigate(action.path);
      } else if (action.action) {
        action.action();
      }
    } else {
      const result = item.item as SearchResult;
      navigate(result.path);
    }
    onClose();
  };
  
  const getResultIcon = (type: string) => {
    switch (type) {
      case 'order': return <Package className="h-5 w-5 text-primary-500" />;
      case 'customer': return <Users className="h-5 w-5 text-emerald-500" />;
      case 'quote': return <FileText className="h-5 w-5 text-amber-500" />;
      case 'inventory': return <Package className="h-5 w-5 text-violet-500" />;
      default: return <Search className="h-5 w-5 text-gray-400" />;
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-start justify-center pt-[15vh] px-4">
        <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
            <Search className="h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search orders, customers, or type a command..."
              className="flex-1 text-lg bg-transparent border-0 outline-none placeholder-gray-400"
              autoFocus
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded">
              <Command className="h-3 w-3" /> K
            </kbd>
          </div>
          
          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {/* Actions Section */}
            {filteredActions.length > 0 && (
              <div className="mb-2">
                {!query && (
                  <p className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Quick Actions
                  </p>
                )}
                {filteredActions.map((action, index) => {
                  const resultIndex = index;
                  return (
                    <button
                      key={action.id}
                      onClick={() => executeItem({ type: 'action', item: action })}
                      onMouseEnter={() => setSelectedIndex(resultIndex)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                        selectedIndex === resultIndex
                          ? 'bg-primary-50 text-primary-700'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <span className={selectedIndex === resultIndex ? 'text-primary-500' : 'text-gray-400'}>
                        {action.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{action.label}</p>
                        {action.description && (
                          <p className="text-sm text-gray-500 truncate">{action.description}</p>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        action.category === 'action' 
                          ? 'bg-amber-100 text-amber-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {action.category === 'action' ? 'Create' : 'Navigate'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            
            {/* Search Results Section */}
            {searchResults.length > 0 && (
              <div>
                <p className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Search Results
                </p>
                {searchResults.map((result: SearchResult, index: number) => {
                  const resultIndex = filteredActions.length + index;
                  return (
                    <button
                      key={result.id}
                      onClick={() => executeItem({ type: 'result', item: result })}
                      onMouseEnter={() => setSelectedIndex(resultIndex)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                        selectedIndex === resultIndex
                          ? 'bg-primary-50 text-primary-700'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      {getResultIcon(result.type)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{result.label}</p>
                        <p className="text-sm text-gray-500 truncate">{result.description}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                        result.type === 'order' ? 'bg-primary-100 text-primary-700'
                        : result.type === 'customer' ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                      }`}>
                        {result.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            
            {/* No Results */}
            {allResults.length === 0 && query && (
              <div className="py-8 text-center text-gray-500">
                <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="font-medium">No results found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">Enter</kbd>
                to select
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">Esc</kbd>
              to close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook to use the quick actions modal
export function useQuickActions() {
  const [isOpen, setIsOpen] = useState(false);
  
  // Global keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
  };
}
