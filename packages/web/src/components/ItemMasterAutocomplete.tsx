import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Package, X } from 'lucide-react';
import { filterBySearchFields } from '@erp/shared';
import { api } from '../lib/api';

export interface ItemMasterOption {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unitPrice: number;
  costPrice: number | null;
}

interface ItemMasterAutocompleteProps {
  /** Currently selected item ID */
  selectedItemId: string | null;
  /** Display text (used when editing existing items that already have a description) */
  displayText?: string;
  /** Called when an item is selected */
  onSelect: (item: ItemMasterOption) => void;
  /** Called when selection is cleared */
  onClear: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes for the container */
  className?: string;
  /** Use costPrice instead of unitPrice (for purchase orders) */
  useCostPrice?: boolean;
  /** Compact mode (smaller padding) */
  compact?: boolean;
}

export function ItemMasterAutocomplete({
  selectedItemId,
  displayText,
  onSelect,
  onClear,
  placeholder = 'Search items by name, SKU, or description...',
  className = '',
  compact = false,
}: ItemMasterAutocompleteProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch all active items (cached globally via queryKey)
  const { data: allItems = [] } = useQuery<ItemMasterOption[]>({
    queryKey: ['item-master-all'],
    queryFn: async () => {
      // Fetch all in batches if needed - most sign shops have <5000 items
      const response = await api.get('/items', { params: { pageSize: 5000, activeOnly: true } });
      return response.data.data.items.map((item: any) => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        description: item.description,
        category: item.category,
        unitPrice: Number(item.unitPrice),
        costPrice: item.costPrice ? Number(item.costPrice) : null,
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Filter items based on search — each word must match somewhere (partial, multi-word)
  const filteredItems = search.trim()
    ? filterBySearchFields(
        allItems,
        search,
        (item) => [item.sku, item.name, item.description, item.category],
        { limit: 50 },
      )
    : allItems.slice(0, 50); // Show first 50 when no search

  // Resolve selected item for display
  const selectedItem = selectedItemId
    ? allItems.find((i) => i.id === selectedItemId)
    : null;

  const selectedLabel = selectedItem
    ? `${selectedItem.sku} - ${selectedItem.name}`
    : displayText || '';

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHighlightIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (item: ItemMasterOption) => {
      onSelect(item);
      setSearch('');
      setIsOpen(false);
      setHighlightIndex(-1);
    },
    [onSelect],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev < filteredItems.length - 1 ? prev + 1 : 0,
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev > 0 ? prev - 1 : filteredItems.length - 1,
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filteredItems.length) {
          handleSelect(filteredItems[highlightIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && dropdownRef.current) {
      const highlighted = dropdownRef.current.children[highlightIndex] as HTMLElement;
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIndex]);

  const padClass = compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5';

  // If an item is selected, show it as a chip
  if (selectedItemId && selectedLabel) {
    return (
      <div className={`relative ${className}`}>
        <div
          className={`flex items-center gap-2 ${padClass} bg-primary-50 border border-primary-200 rounded-xl text-sm cursor-pointer group transition-colors hover:bg-primary-100`}
          onClick={() => {
            onClear();
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          title="Click to change item"
        >
          <Package className="h-4 w-4 text-primary-500 flex-shrink-0" />
          <span className="flex-1 truncate text-primary-900 font-medium">
            {selectedLabel}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="p-0.5 rounded hover:bg-primary-200 text-primary-400 hover:text-primary-600 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
            setHighlightIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`input-field pl-9 ${padClass} ${compact ? '!py-1.5' : ''}`}
          autoComplete="off"
        />
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto"
        >
          {filteredItems.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray-500">
              <Package className="h-8 w-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-medium">No items found</p>
              <p className="text-xs text-gray-400 mt-1">
                {search ? 'Try a different search term' : 'No active items in the catalog'}
              </p>
            </div>
          ) : (
            filteredItems.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur before click
                  handleSelect(item);
                }}
                onMouseEnter={() => setHighlightIndex(index)}
                className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors border-b border-gray-50 last:border-0 ${
                  highlightIndex === index
                    ? 'bg-primary-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      {item.sku}
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {item.name}
                    </span>
                  </div>
                  {item.description && item.description !== item.name && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {item.description}
                    </p>
                  )}
                  {item.category && (
                    <span className="inline-block text-[10px] text-gray-400 mt-0.5">
                      {item.category}
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                  ${item.unitPrice.toFixed(2)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
