import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import {
  Filter,
  Save,
  Trash2,
  ChevronDown,
  Check,
  Star,
  StarOff,
  MoreVertical,
  Edit2,
  X,
  Plus,
} from 'lucide-react';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface FilterValue {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'between';
  value: unknown;
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: FilterValue[];
  isDefault?: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface FilterPresetProps {
  /** Currently applied filters */
  currentFilters: FilterValue[];
  /** List of saved filter presets */
  savedPresets: SavedFilter[];
  /** Callback when a preset is selected */
  onSelectPreset: (preset: SavedFilter) => void;
  /** Callback to save current filters as a new preset */
  onSavePreset: (name: string, isDefault?: boolean) => void;
  /** Callback to update an existing preset */
  onUpdatePreset: (id: string, updates: Partial<SavedFilter>) => void;
  /** Callback to delete a preset */
  onDeletePreset: (id: string) => void;
  /** Callback to set a preset as default */
  onSetDefault: (id: string | null) => void;
  /** Custom className */
  className?: string;
  /** Placeholder text for dropdown */
  placeholder?: string;
  /** Whether to show the save button */
  showSaveButton?: boolean;
  /** Label for the component */
  label?: string;
}

export interface FilterPresetButtonProps {
  preset: SavedFilter;
  isActive?: boolean;
  onClick: () => void;
  onDelete?: () => void;
  onSetDefault?: () => void;
  compact?: boolean;
}

export interface SaveFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, isDefault: boolean) => void;
  existingName?: string;
}

// ============================================================================
// SaveFilterModal Component
// ============================================================================

export function SaveFilterModal({
  isOpen,
  onClose,
  onSave,
  existingName = '',
}: SaveFilterModalProps) {
  const [name, setName] = useState(existingName);
  const [isDefault, setIsDefault] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(existingName);
      setIsDefault(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, existingName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim(), isDefault);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Save Filter Preset
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label 
                htmlFor="preset-name" 
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Preset Name
              </label>
              <input
                ref={inputRef}
                id="preset-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Active Orders This Month"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Set as default filter (loads automatically)
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Preset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// FilterPresetButton Component
// ============================================================================

export function FilterPresetButton({
  preset,
  isActive,
  onClick,
  onDelete,
  onSetDefault,
  compact = false,
}: FilterPresetButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={onClick}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-blue-100 text-blue-700 border border-blue-200'
            : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200',
          compact && 'px-2 py-1',
        )}
      >
        {preset.isDefault && (
          <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
        )}
        <span className="truncate max-w-32">{preset.name}</span>
        {isActive && <Check className="h-3.5 w-3.5" />}
        
        {(onDelete || onSetDefault) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-0.5 hover:bg-black/10 rounded"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        )}
      </button>

      {/* Context Menu */}
      {showMenu && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-36">
          {onSetDefault && (
            <button
              onClick={() => {
                onSetDefault();
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              {preset.isDefault ? (
                <>
                  <StarOff className="h-4 w-4" />
                  Remove Default
                </>
              ) : (
                <>
                  <Star className="h-4 w-4" />
                  Set as Default
                </>
              )}
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => {
                onDelete();
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FilterPreset Component (Main)
// ============================================================================

export function FilterPreset({
  currentFilters,
  savedPresets,
  onSelectPreset,
  onSavePreset,
  onUpdatePreset,
  onDeletePreset,
  onSetDefault,
  className,
  placeholder = 'Select a filter preset...',
  showSaveButton = true,
  label,
}: FilterPresetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find active preset (matches current filters)
  const activePreset = savedPresets.find(
    (preset) => JSON.stringify(preset.filters) === JSON.stringify(currentFilters)
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const hasFilters = currentFilters.length > 0;
  const canSave = hasFilters && !activePreset;

  return (
    <div className={clsx('relative', className)} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      <div className="flex items-center gap-2">
        {/* Dropdown Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors min-w-40',
            isOpen
              ? 'border-blue-500 ring-2 ring-blue-500/20'
              : 'border-gray-300 hover:border-gray-400',
            activePreset ? 'bg-blue-50' : 'bg-white',
          )}
        >
          <Filter className="h-4 w-4 text-gray-400" />
          <span className={clsx(
            'flex-1 text-left truncate',
            activePreset ? 'text-blue-700' : 'text-gray-700',
          )}>
            {activePreset ? activePreset.name : placeholder}
          </span>
          <ChevronDown className={clsx(
            'h-4 w-4 text-gray-400 transition-transform',
            isOpen && 'rotate-180',
          )} />
        </button>

        {/* Save Button */}
        {showSaveButton && canSave && (
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-64 max-h-80 overflow-auto">
          {/* Clear/All option */}
          <button
            onClick={() => {
              onSelectPreset({ id: '', name: '', filters: [], createdAt: new Date() });
              setIsOpen(false);
            }}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50',
              !activePreset && currentFilters.length === 0 && 'bg-gray-50',
            )}
          >
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">All (no filters)</span>
            {!activePreset && currentFilters.length === 0 && (
              <Check className="h-4 w-4 text-blue-600 ml-auto" />
            )}
          </button>

          {savedPresets.length > 0 && (
            <div className="border-t border-gray-100 my-1" />
          )}

          {/* Saved presets */}
          {savedPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                onSelectPreset(preset);
                setIsOpen(false);
              }}
              className={clsx(
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 group',
                activePreset?.id === preset.id && 'bg-blue-50',
              )}
            >
              {preset.isDefault ? (
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              ) : (
                <Filter className="h-4 w-4 text-gray-400" />
              )}
              <span className={clsx(
                'flex-1 truncate',
                activePreset?.id === preset.id ? 'text-blue-700 font-medium' : 'text-gray-700',
              )}>
                {preset.name}
              </span>
              <span className="text-xs text-gray-400">
                {preset.filters.length} filter{preset.filters.length !== 1 ? 's' : ''}
              </span>
              {activePreset?.id === preset.id && (
                <Check className="h-4 w-4 text-blue-600" />
              )}

              {/* Quick actions on hover */}
              <div className="hidden group-hover:flex items-center gap-1 ml-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetDefault(preset.isDefault ? null : preset.id);
                  }}
                  className="p-1 text-gray-400 hover:text-amber-500 rounded"
                  title={preset.isDefault ? 'Remove default' : 'Set as default'}
                >
                  {preset.isDefault ? (
                    <StarOff className="h-3.5 w-3.5" />
                  ) : (
                    <Star className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePreset(preset.id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 rounded"
                  title="Delete preset"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </button>
          ))}

          {/* Add new preset from dropdown */}
          {hasFilters && (
            <>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowSaveModal(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
              >
                <Plus className="h-4 w-4" />
                Save current filters as preset
              </button>
            </>
          )}
        </div>
      )}

      {/* Save Modal */}
      <SaveFilterModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={(name, isDefault) => {
          onSavePreset(name, isDefault);
          setShowSaveModal(false);
        }}
      />
    </div>
  );
}

// ============================================================================
// FilterPresetPills - Horizontal pill-style preset selector
// ============================================================================

export interface FilterPresetPillsProps {
  presets: SavedFilter[];
  activePresetId?: string;
  onSelect: (preset: SavedFilter) => void;
  onClear?: () => void;
  className?: string;
  showClear?: boolean;
}

export function FilterPresetPills({
  presets,
  activePresetId,
  onSelect,
  onClear,
  className,
  showClear = true,
}: FilterPresetPillsProps) {
  return (
    <div className={clsx('flex items-center gap-2 flex-wrap', className)}>
      {showClear && (
        <button
          onClick={onClear}
          className={clsx(
            'px-3 py-1.5 text-sm font-medium rounded-full transition-colors',
            !activePresetId
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          )}
        >
          All
        </button>
      )}
      {presets.map((preset) => (
        <button
          key={preset.id}
          onClick={() => onSelect(preset)}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full transition-colors',
            preset.id === activePresetId
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          )}
        >
          {preset.isDefault && (
            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
          )}
          {preset.name}
        </button>
      ))}
    </div>
  );
}
