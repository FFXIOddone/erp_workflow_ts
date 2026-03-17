import { Search, X } from 'lucide-react';
import { useRef, useState, useEffect, useCallback } from 'react';
import { Spinner } from './Spinner';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  isLoading?: boolean;
  autoFocus?: boolean;
  className?: string;
  onSubmit?: () => void;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
  isLoading = false,
  autoFocus = false,
  className = '',
  onSubmit,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced onChange
  const handleChange = useCallback((newValue: string) => {
    setLocalValue(newValue);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      onChange(newValue);
    }, debounceMs);
  }, [onChange, debounceMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleClear = () => {
    setLocalValue('');
    onChange('');
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    onChange(localValue);
    onSubmit?.();
  };

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      {/* Search icon or loading spinner */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2">
        {isLoading ? (
          <Spinner size="sm" color="gray" />
        ) : (
          <Search className="h-4 w-4 text-gray-400" />
        )}
      </div>
      
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg 
                   bg-white text-gray-900 placeholder:text-gray-400
                   transition-all duration-200
                   focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
      />
      
      {/* Clear button */}
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md 
                     text-gray-400 hover:text-gray-600 hover:bg-gray-100 
                     transition-colors"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}

// Inline search for tables/lists with instant filtering
interface InlineSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function InlineSearch({ value, onChange, placeholder = 'Filter...', className = '' }: InlineSearchProps) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-md
                   bg-white text-gray-900 placeholder:text-gray-400
                   focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
