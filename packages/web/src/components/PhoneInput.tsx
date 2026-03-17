/**
 * PhoneInput.tsx - CRITICAL-44
 * 
 * Phone number input components for the ERP application.
 * International phone number input with country codes.
 * 
 * Features:
 * - 44.1: Country code selector
 * - 44.2: Phone number formatting
 * - 44.3: Phone validation
 * - 44.4: Extension support
 * - 44.5: Click to call
 * 
 * @module PhoneInput
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  forwardRef,
  type ReactNode,
  type KeyboardEvent,
  type ChangeEvent,
  type FocusEvent,
} from 'react';
import { clsx } from 'clsx';
import {
  Phone,
  ChevronDown,
  Search,
  X,
  Check,
  AlertCircle,
  Globe,
  Copy,
  ExternalLink,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Country data */
export interface Country {
  /** Country code (ISO 3166-1 alpha-2) */
  code: string;
  /** Country name */
  name: string;
  /** Dial code (e.g., +1) */
  dialCode: string;
  /** Flag emoji */
  flag: string;
  /** Phone format pattern */
  format?: string;
  /** Phone length (without country code) */
  phoneLength?: number | number[];
}

/** Phone value */
export interface PhoneValue {
  /** Country code */
  countryCode: string;
  /** Phone number (without country code) */
  number: string;
  /** Extension */
  extension?: string;
}

/** Phone input props */
export interface PhoneInputProps {
  /** Value */
  value: PhoneValue | null;
  /** On change */
  onChange: (value: PhoneValue | null) => void;
  /** Default country */
  defaultCountry?: string;
  /** Allowed countries */
  countries?: string[];
  /** Preferred countries (shown at top) */
  preferredCountries?: string[];
  /** Show country selector */
  showCountrySelector?: boolean;
  /** Show extension field */
  showExtension?: boolean;
  /** Placeholder */
  placeholder?: string;
  /** Disabled */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Class name */
  className?: string;
}

/** Phone display props */
export interface PhoneDisplayProps {
  /** Phone value */
  value: PhoneValue | null;
  /** Format type */
  format?: 'national' | 'international' | 'e164';
  /** Show copy button */
  showCopy?: boolean;
  /** Show call button */
  showCall?: boolean;
  /** Class name */
  className?: string;
}

// ============================================================================
// COUNTRY DATA
// ============================================================================

const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', format: '(###) ###-####', phoneLength: 10 },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', format: '(###) ###-####', phoneLength: 10 },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', format: '#### ######', phoneLength: 10 },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', format: '#### ### ###', phoneLength: 9 },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', format: '#### ######', phoneLength: [10, 11] },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', format: '# ## ## ## ##', phoneLength: 9 },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸', format: '### ### ###', phoneLength: 9 },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹', format: '### ### ####', phoneLength: 10 },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱', format: '## ### ####', phoneLength: 9 },
  { code: 'BE', name: 'Belgium', dialCode: '+32', flag: '🇧🇪', format: '### ## ## ##', phoneLength: 9 },
  { code: 'CH', name: 'Switzerland', dialCode: '+41', flag: '🇨🇭', format: '## ### ## ##', phoneLength: 9 },
  { code: 'AT', name: 'Austria', dialCode: '+43', flag: '🇦🇹', format: '### #######', phoneLength: 10 },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵', format: '##-####-####', phoneLength: 10 },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳', format: '### #### ####', phoneLength: 11 },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', format: '##### #####', phoneLength: 10 },
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷', format: '## #####-####', phoneLength: 11 },
  { code: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽', format: '## #### ####', phoneLength: 10 },
  { code: 'KR', name: 'South Korea', dialCode: '+82', flag: '🇰🇷', format: '##-####-####', phoneLength: 10 },
  { code: 'RU', name: 'Russia', dialCode: '+7', flag: '🇷🇺', format: '### ###-##-##', phoneLength: 10 },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦', format: '## ### ####', phoneLength: 9 },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', format: '## ### ####', phoneLength: 9 },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬', format: '#### ####', phoneLength: 8 },
  { code: 'HK', name: 'Hong Kong', dialCode: '+852', flag: '🇭🇰', format: '#### ####', phoneLength: 8 },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿', format: '## ### ####', phoneLength: 9 },
  { code: 'IE', name: 'Ireland', dialCode: '+353', flag: '🇮🇪', format: '## ### ####', phoneLength: 9 },
  { code: 'PL', name: 'Poland', dialCode: '+48', flag: '🇵🇱', format: '### ### ###', phoneLength: 9 },
  { code: 'SE', name: 'Sweden', dialCode: '+46', flag: '🇸🇪', format: '## ### ## ##', phoneLength: 9 },
  { code: 'NO', name: 'Norway', dialCode: '+47', flag: '🇳🇴', format: '### ## ###', phoneLength: 8 },
  { code: 'DK', name: 'Denmark', dialCode: '+45', flag: '🇩🇰', format: '## ## ## ##', phoneLength: 8 },
  { code: 'FI', name: 'Finland', dialCode: '+358', flag: '🇫🇮', format: '## ### ####', phoneLength: 9 },
];

/** Get country by code */
function getCountry(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

/** Get country by dial code */
function getCountryByDialCode(dialCode: string): Country | undefined {
  return COUNTRIES.find((c) => c.dialCode === dialCode);
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Format phone number according to pattern */
export function formatPhone(number: string, pattern?: string): string {
  if (!pattern || !number) return number;

  const digits = number.replace(/\D/g, '');
  let result = '';
  let digitIndex = 0;

  for (const char of pattern) {
    if (digitIndex >= digits.length) break;

    if (char === '#') {
      result += digits[digitIndex];
      digitIndex++;
    } else {
      result += char;
    }
  }

  // Append remaining digits
  if (digitIndex < digits.length) {
    result += digits.slice(digitIndex);
  }

  return result;
}

/** Parse phone number (remove formatting) */
export function parsePhone(value: string): string {
  return value.replace(/\D/g, '');
}

/** Validate phone number length */
export function validatePhoneLength(number: string, country: Country): boolean {
  const digits = parsePhone(number);
  const expectedLength = country.phoneLength;

  if (!expectedLength) return true;

  if (Array.isArray(expectedLength)) {
    return expectedLength.includes(digits.length);
  }

  return digits.length === expectedLength;
}

/** Format phone to E.164 format */
export function toE164(value: PhoneValue): string {
  const country = getCountry(value.countryCode);
  if (!country) return value.number;

  const digits = parsePhone(value.number);
  return `${country.dialCode}${digits}`;
}

/** Format phone for display */
export function formatPhoneDisplay(
  value: PhoneValue | null,
  format: 'national' | 'international' | 'e164' = 'national'
): string {
  if (!value) return '';

  const country = getCountry(value.countryCode);
  if (!country) return value.number;

  const formattedNumber = formatPhone(value.number, country.format);

  switch (format) {
    case 'e164':
      return toE164(value);
    case 'international':
      return `${country.dialCode} ${formattedNumber}`;
    case 'national':
    default:
      return formattedNumber;
  }
}

// ============================================================================
// 44.1-44.4: PHONE INPUT COMPONENT
// ============================================================================

/**
 * Phone number input with country selector
 * 
 * @example
 * ```tsx
 * const [phone, setPhone] = useState<PhoneValue | null>(null);
 * 
 * <PhoneInput
 *   value={phone}
 *   onChange={setPhone}
 *   defaultCountry="US"
 *   showExtension
 * />
 * ```
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(({
  value,
  onChange,
  defaultCountry = 'US',
  countries,
  preferredCountries = ['US', 'CA', 'GB'],
  showCountrySelector = true,
  showExtension = false,
  placeholder = 'Phone number',
  disabled = false,
  error,
  size = 'md',
  className,
}, ref) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    getCountry(value?.countryCode || defaultCountry) || COUNTRIES[0]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Filter available countries
  const availableCountries = useMemo(() => {
    let filtered = countries
      ? COUNTRIES.filter((c) => countries.includes(c.code))
      : COUNTRIES;

    if (search) {
      const lowerSearch = search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(lowerSearch) ||
          c.dialCode.includes(lowerSearch) ||
          c.code.toLowerCase().includes(lowerSearch)
      );
    }

    // Sort with preferred countries first
    return filtered.sort((a, b) => {
      const aPreferred = preferredCountries.includes(a.code);
      const bPreferred = preferredCountries.includes(b.code);
      if (aPreferred && !bPreferred) return -1;
      if (!aPreferred && bPreferred) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [countries, search, preferredCountries]);

  // Handle phone number change
  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const digits = parsePhone(rawValue);

    onChange({
      countryCode: selectedCountry.code,
      number: digits,
      extension: value?.extension,
    });
  };

  // Handle extension change
  const handleExtensionChange = (e: ChangeEvent<HTMLInputElement>) => {
    const ext = e.target.value.replace(/\D/g, '');

    if (value) {
      onChange({
        ...value,
        extension: ext || undefined,
      });
    }
  };

  // Handle country selection
  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setShowDropdown(false);
    setSearch('');

    if (value) {
      onChange({
        ...value,
        countryCode: country.code,
      });
    }
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search on dropdown open
  useEffect(() => {
    if (showDropdown) {
      searchRef.current?.focus();
    }
  }, [showDropdown]);

  // Validate phone
  const isValid = !value || validatePhoneLength(value.number, selectedCountry);

  const sizeClasses = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-base',
    lg: 'h-12 text-lg',
  };

  return (
    <div className={className} ref={containerRef}>
      <div className={clsx(
        'flex border rounded-lg overflow-hidden',
        'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500',
        (error || !isValid) && 'border-red-500',
        disabled && 'bg-gray-100 cursor-not-allowed'
      )}>
        {/* Country selector */}
        {showCountrySelector && (
          <div className="relative">
            <button
              type="button"
              onClick={() => !disabled && setShowDropdown(!showDropdown)}
              disabled={disabled}
              className={clsx(
                'flex items-center gap-1 px-3 border-r bg-gray-50 dark:bg-gray-800',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                disabled && 'cursor-not-allowed',
                sizeClasses[size]
              )}
            >
              <span className="text-xl">{selectedCountry.flag}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {/* Country dropdown */}
            {showDropdown && (
              <div className="absolute left-0 top-full z-50 mt-1 w-72 bg-white dark:bg-gray-800 border rounded-lg shadow-lg">
                {/* Search */}
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      ref={searchRef}
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search countries..."
                      className="w-full pl-8 pr-3 py-2 text-sm border rounded outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Country list */}
                <div className="max-h-60 overflow-y-auto">
                  {availableCountries.map((country, index) => {
                    const isPreferred = preferredCountries.includes(country.code);
                    const prevIsPreferred = index > 0 && preferredCountries.includes(availableCountries[index - 1].code);
                    const showDivider = isPreferred !== prevIsPreferred && index > 0;

                    return (
                      <React.Fragment key={country.code}>
                        {showDivider && (
                          <div className="border-t my-1" />
                        )}
                        <button
                          type="button"
                          onClick={() => handleCountrySelect(country)}
                          className={clsx(
                            'w-full flex items-center gap-3 px-3 py-2 text-left',
                            'hover:bg-gray-50 dark:hover:bg-gray-700',
                            country.code === selectedCountry.code && 'bg-blue-50 dark:bg-blue-900/30'
                          )}
                        >
                          <span className="text-xl">{country.flag}</span>
                          <span className="flex-1 truncate">{country.name}</span>
                          <span className="text-sm text-gray-500">{country.dialCode}</span>
                          {country.code === selectedCountry.code && (
                            <Check className="w-4 h-4 text-blue-500" />
                          )}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dial code display (when selector hidden) */}
        {!showCountrySelector && (
          <span className={clsx(
            'flex items-center px-3 border-r bg-gray-50 text-gray-600',
            sizeClasses[size]
          )}>
            {selectedCountry.dialCode}
          </span>
        )}

        {/* Phone input */}
        <input
          ref={ref}
          type="tel"
          value={value ? formatPhone(value.number, selectedCountry.format) : ''}
          onChange={handlePhoneChange}
          placeholder={placeholder}
          disabled={disabled}
          className={clsx(
            'flex-1 px-3 outline-none bg-transparent',
            disabled && 'cursor-not-allowed',
            sizeClasses[size]
          )}
        />

        {/* Extension input */}
        {showExtension && (
          <>
            <span className="flex items-center px-2 text-gray-400 text-sm">ext.</span>
            <input
              type="text"
              value={value?.extension || ''}
              onChange={handleExtensionChange}
              placeholder="123"
              disabled={disabled}
              className={clsx(
                'w-16 px-2 border-l outline-none bg-transparent',
                disabled && 'cursor-not-allowed',
                sizeClasses[size]
              )}
            />
          </>
        )}
      </div>

      {/* Error message */}
      {(error || !isValid) && (
        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error || 'Invalid phone number'}
        </p>
      )}
    </div>
  );
});

PhoneInput.displayName = 'PhoneInput';

// ============================================================================
// 44.5: PHONE DISPLAY
// ============================================================================

/**
 * Phone number display with actions
 * 
 * @example
 * ```tsx
 * <PhoneDisplay
 *   value={{ countryCode: 'US', number: '5551234567' }}
 *   format="international"
 *   showCopy
 *   showCall
 * />
 * ```
 */
export function PhoneDisplay({
  value,
  format = 'national',
  showCopy = false,
  showCall = true,
  className,
}: PhoneDisplayProps) {
  const [copied, setCopied] = useState(false);

  const formatted = formatPhoneDisplay(value, format);
  const e164 = value ? toE164(value) : '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(e164);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCall = () => {
    window.location.href = `tel:${e164}`;
  };

  if (!value) {
    return <span className={clsx('text-gray-400', className)}>-</span>;
  }

  const country = getCountry(value.countryCode);

  return (
    <span className={clsx('inline-flex items-center gap-2', className)}>
      {country && <span>{country.flag}</span>}
      <span>{formatted}</span>
      {value.extension && <span className="text-gray-500">ext. {value.extension}</span>}

      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
          title="Copy"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      )}

      {showCall && (
        <a
          href={`tel:${e164}`}
          className="p-1 text-blue-500 hover:text-blue-600 rounded"
          title="Call"
        >
          <Phone className="w-4 h-4" />
        </a>
      )}
    </span>
  );
}

// ============================================================================
// PHONE LINK
// ============================================================================

interface PhoneLinkProps {
  value: PhoneValue;
  children?: ReactNode;
  className?: string;
}

/**
 * Clickable phone link
 */
export function PhoneLink({ value, children, className }: PhoneLinkProps) {
  const e164 = toE164(value);
  const display = children || formatPhoneDisplay(value, 'national');

  return (
    <a
      href={`tel:${e164}`}
      className={clsx(
        'inline-flex items-center gap-1 text-blue-600 hover:text-blue-800',
        className
      )}
    >
      <Phone className="w-4 h-4" />
      {display}
    </a>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  COUNTRIES,
  getCountry,
  getCountryByDialCode,
};
