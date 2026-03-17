/**
 * AddressInput.tsx - CRITICAL-45
 * 
 * Address input components for the ERP application.
 * Structured address form with validation and autocomplete.
 * 
 * Features:
 * - 45.1: Structured address form
 * - 45.2: Country/state dropdowns
 * - 45.3: Address validation
 * - 45.4: Address display formatting
 * - 45.5: Map integration placeholder
 * 
 * @module AddressInput
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
  type ChangeEvent,
} from 'react';
import { clsx } from 'clsx';
import {
  MapPin,
  Building,
  Home,
  ChevronDown,
  Search,
  Check,
  AlertCircle,
  Copy,
  ExternalLink,
  Map,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Address value */
export interface AddressValue {
  /** Street line 1 */
  street1: string;
  /** Street line 2 (apt, suite, etc.) */
  street2?: string;
  /** City */
  city: string;
  /** State/Province */
  state: string;
  /** Postal/ZIP code */
  postalCode: string;
  /** Country code (ISO 3166-1 alpha-2) */
  country: string;
}

/** Address input props */
export interface AddressInputProps {
  /** Value */
  value: AddressValue;
  /** On change */
  onChange: (value: AddressValue) => void;
  /** Default country */
  defaultCountry?: string;
  /** Allowed countries */
  countries?: string[];
  /** Show second street line */
  showStreet2?: boolean;
  /** Labels */
  labels?: Partial<AddressLabels>;
  /** Placeholders */
  placeholders?: Partial<AddressLabels>;
  /** Required fields */
  required?: (keyof AddressValue)[];
  /** Disabled */
  disabled?: boolean;
  /** Errors per field */
  errors?: Partial<Record<keyof AddressValue, string>>;
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Layout */
  layout?: 'vertical' | 'compact';
  /** Class name */
  className?: string;
}

/** Address labels */
interface AddressLabels {
  street1: string;
  street2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/** Address display props */
export interface AddressDisplayProps {
  /** Address value */
  value: AddressValue | null;
  /** Format */
  format?: 'single-line' | 'multi-line';
  /** Show copy button */
  showCopy?: boolean;
  /** Show map link */
  showMapLink?: boolean;
  /** Class name */
  className?: string;
}

// ============================================================================
// COUNTRY & STATE DATA
// ============================================================================

export interface CountryData {
  code: string;
  name: string;
  states?: { code: string; name: string }[];
  postalCodeFormat?: string;
  postalCodeLabel?: string;
  stateLabel?: string;
}

const COUNTRIES: CountryData[] = [
  {
    code: 'US',
    name: 'United States',
    postalCodeLabel: 'ZIP Code',
    stateLabel: 'State',
    postalCodeFormat: '#####',
    states: [
      { code: 'AL', name: 'Alabama' },
      { code: 'AK', name: 'Alaska' },
      { code: 'AZ', name: 'Arizona' },
      { code: 'AR', name: 'Arkansas' },
      { code: 'CA', name: 'California' },
      { code: 'CO', name: 'Colorado' },
      { code: 'CT', name: 'Connecticut' },
      { code: 'DE', name: 'Delaware' },
      { code: 'FL', name: 'Florida' },
      { code: 'GA', name: 'Georgia' },
      { code: 'HI', name: 'Hawaii' },
      { code: 'ID', name: 'Idaho' },
      { code: 'IL', name: 'Illinois' },
      { code: 'IN', name: 'Indiana' },
      { code: 'IA', name: 'Iowa' },
      { code: 'KS', name: 'Kansas' },
      { code: 'KY', name: 'Kentucky' },
      { code: 'LA', name: 'Louisiana' },
      { code: 'ME', name: 'Maine' },
      { code: 'MD', name: 'Maryland' },
      { code: 'MA', name: 'Massachusetts' },
      { code: 'MI', name: 'Michigan' },
      { code: 'MN', name: 'Minnesota' },
      { code: 'MS', name: 'Mississippi' },
      { code: 'MO', name: 'Missouri' },
      { code: 'MT', name: 'Montana' },
      { code: 'NE', name: 'Nebraska' },
      { code: 'NV', name: 'Nevada' },
      { code: 'NH', name: 'New Hampshire' },
      { code: 'NJ', name: 'New Jersey' },
      { code: 'NM', name: 'New Mexico' },
      { code: 'NY', name: 'New York' },
      { code: 'NC', name: 'North Carolina' },
      { code: 'ND', name: 'North Dakota' },
      { code: 'OH', name: 'Ohio' },
      { code: 'OK', name: 'Oklahoma' },
      { code: 'OR', name: 'Oregon' },
      { code: 'PA', name: 'Pennsylvania' },
      { code: 'RI', name: 'Rhode Island' },
      { code: 'SC', name: 'South Carolina' },
      { code: 'SD', name: 'South Dakota' },
      { code: 'TN', name: 'Tennessee' },
      { code: 'TX', name: 'Texas' },
      { code: 'UT', name: 'Utah' },
      { code: 'VT', name: 'Vermont' },
      { code: 'VA', name: 'Virginia' },
      { code: 'WA', name: 'Washington' },
      { code: 'WV', name: 'West Virginia' },
      { code: 'WI', name: 'Wisconsin' },
      { code: 'WY', name: 'Wyoming' },
      { code: 'DC', name: 'District of Columbia' },
    ],
  },
  {
    code: 'CA',
    name: 'Canada',
    postalCodeLabel: 'Postal Code',
    stateLabel: 'Province',
    states: [
      { code: 'AB', name: 'Alberta' },
      { code: 'BC', name: 'British Columbia' },
      { code: 'MB', name: 'Manitoba' },
      { code: 'NB', name: 'New Brunswick' },
      { code: 'NL', name: 'Newfoundland and Labrador' },
      { code: 'NS', name: 'Nova Scotia' },
      { code: 'NT', name: 'Northwest Territories' },
      { code: 'NU', name: 'Nunavut' },
      { code: 'ON', name: 'Ontario' },
      { code: 'PE', name: 'Prince Edward Island' },
      { code: 'QC', name: 'Quebec' },
      { code: 'SK', name: 'Saskatchewan' },
      { code: 'YT', name: 'Yukon' },
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    postalCodeLabel: 'Postcode',
    stateLabel: 'County',
  },
  {
    code: 'AU',
    name: 'Australia',
    postalCodeLabel: 'Postcode',
    stateLabel: 'State',
    states: [
      { code: 'ACT', name: 'Australian Capital Territory' },
      { code: 'NSW', name: 'New South Wales' },
      { code: 'NT', name: 'Northern Territory' },
      { code: 'QLD', name: 'Queensland' },
      { code: 'SA', name: 'South Australia' },
      { code: 'TAS', name: 'Tasmania' },
      { code: 'VIC', name: 'Victoria' },
      { code: 'WA', name: 'Western Australia' },
    ],
  },
  { code: 'DE', name: 'Germany', postalCodeLabel: 'PLZ', stateLabel: 'State' },
  { code: 'FR', name: 'France', postalCodeLabel: 'Code Postal', stateLabel: 'Region' },
  { code: 'ES', name: 'Spain', postalCodeLabel: 'Código Postal', stateLabel: 'Province' },
  { code: 'IT', name: 'Italy', postalCodeLabel: 'CAP', stateLabel: 'Province' },
  { code: 'NL', name: 'Netherlands', postalCodeLabel: 'Postcode', stateLabel: 'Province' },
  { code: 'BE', name: 'Belgium', postalCodeLabel: 'Code Postal', stateLabel: 'Province' },
  { code: 'CH', name: 'Switzerland', postalCodeLabel: 'PLZ', stateLabel: 'Canton' },
  { code: 'AT', name: 'Austria', postalCodeLabel: 'PLZ', stateLabel: 'State' },
  { code: 'JP', name: 'Japan', postalCodeLabel: 'Postal Code', stateLabel: 'Prefecture' },
  { code: 'CN', name: 'China', postalCodeLabel: 'Postal Code', stateLabel: 'Province' },
  { code: 'IN', name: 'India', postalCodeLabel: 'PIN Code', stateLabel: 'State' },
  { code: 'BR', name: 'Brazil', postalCodeLabel: 'CEP', stateLabel: 'State' },
  { code: 'MX', name: 'Mexico', postalCodeLabel: 'Código Postal', stateLabel: 'State' },
];

/** Get country by code */
function getCountryData(code: string): CountryData | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Format address for display */
export function formatAddress(
  address: AddressValue | null,
  format: 'single-line' | 'multi-line' = 'single-line'
): string {
  if (!address) return '';

  const country = getCountryData(address.country);
  const countryName = country?.name || address.country;

  const parts = [
    address.street1,
    address.street2,
    address.city,
    address.state && address.postalCode
      ? `${address.state} ${address.postalCode}`
      : address.state || address.postalCode,
    countryName,
  ].filter(Boolean);

  if (format === 'multi-line') {
    return parts.join('\n');
  }

  return parts.join(', ');
}

/** Generate Google Maps URL */
export function getGoogleMapsUrl(address: AddressValue): string {
  const query = encodeURIComponent(formatAddress(address, 'single-line'));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/** Validate address */
export function validateAddress(
  address: AddressValue,
  required: (keyof AddressValue)[] = ['street1', 'city', 'state', 'postalCode', 'country']
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (required.includes('street1') && !address.street1.trim()) {
    errors.street1 = 'Street address is required';
  }

  if (required.includes('city') && !address.city.trim()) {
    errors.city = 'City is required';
  }

  if (required.includes('state') && !address.state.trim()) {
    errors.state = 'State/Province is required';
  }

  if (required.includes('postalCode') && !address.postalCode.trim()) {
    errors.postalCode = 'Postal code is required';
  }

  if (required.includes('country') && !address.country) {
    errors.country = 'Country is required';
  }

  return errors;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_LABELS: AddressLabels = {
  street1: 'Street Address',
  street2: 'Apt, Suite, Unit, etc.',
  city: 'City',
  state: 'State',
  postalCode: 'ZIP/Postal Code',
  country: 'Country',
};

const DEFAULT_PLACEHOLDERS: AddressLabels = {
  street1: '123 Main St',
  street2: 'Apt 4B',
  city: 'New York',
  state: 'NY',
  postalCode: '10001',
  country: 'Select country',
};

const EMPTY_ADDRESS: AddressValue = {
  street1: '',
  street2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
};

// ============================================================================
// 45.1-45.3: ADDRESS INPUT COMPONENT
// ============================================================================

/**
 * Structured address input form
 * 
 * @example
 * ```tsx
 * const [address, setAddress] = useState<AddressValue>(EMPTY_ADDRESS);
 * 
 * <AddressInput
 *   value={address}
 *   onChange={setAddress}
 *   showStreet2
 *   required={['street1', 'city', 'state', 'postalCode']}
 * />
 * ```
 */
export function AddressInput({
  value,
  onChange,
  defaultCountry = 'US',
  countries,
  showStreet2 = true,
  labels: customLabels,
  placeholders: customPlaceholders,
  required = ['street1', 'city', 'state', 'postalCode', 'country'],
  disabled = false,
  errors = {},
  size = 'md',
  layout = 'vertical',
  className,
}: AddressInputProps) {
  const labels = { ...DEFAULT_LABELS, ...customLabels };
  const placeholders = { ...DEFAULT_PLACEHOLDERS, ...customPlaceholders };

  // Filter available countries
  const availableCountries = useMemo(() => {
    if (countries) {
      return COUNTRIES.filter((c) => countries.includes(c.code));
    }
    return COUNTRIES;
  }, [countries]);

  // Get current country data
  const countryData = getCountryData(value.country);
  const states = countryData?.states || [];

  // Update labels based on country
  const stateLabel = countryData?.stateLabel || labels.state;
  const postalLabel = countryData?.postalCodeLabel || labels.postalCode;

  // Handle field change
  const handleChange = (field: keyof AddressValue, fieldValue: string) => {
    const newValue = { ...value, [field]: fieldValue };

    // Clear state if country changes and states don't match
    if (field === 'country') {
      const newCountryData = getCountryData(fieldValue);
      if (newCountryData?.states && !newCountryData.states.some((s) => s.code === value.state)) {
        newValue.state = '';
      }
    }

    onChange(newValue);
  };

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const inputClasses = clsx(
    'w-full px-3 py-2 border rounded-lg',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
    'dark:bg-gray-800 dark:border-gray-700 dark:text-white',
    disabled && 'bg-gray-100 cursor-not-allowed',
    sizeClasses[size]
  );

  const isCompact = layout === 'compact';

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Country */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {labels.country}
          {required.includes('country') && <span className="text-red-500 ml-1">*</span>}
        </label>
        <select
          value={value.country}
          onChange={(e) => handleChange('country', e.target.value)}
          disabled={disabled}
          className={clsx(inputClasses, errors.country && 'border-red-500')}
        >
          <option value="">{placeholders.country}</option>
          {availableCountries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
        {errors.country && (
          <p className="mt-1 text-sm text-red-600">{errors.country}</p>
        )}
      </div>

      {/* Street 1 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {labels.street1}
          {required.includes('street1') && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
          type="text"
          value={value.street1}
          onChange={(e) => handleChange('street1', e.target.value)}
          placeholder={placeholders.street1}
          disabled={disabled}
          className={clsx(inputClasses, errors.street1 && 'border-red-500')}
        />
        {errors.street1 && (
          <p className="mt-1 text-sm text-red-600">{errors.street1}</p>
        )}
      </div>

      {/* Street 2 */}
      {showStreet2 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {labels.street2}
          </label>
          <input
            type="text"
            value={value.street2 || ''}
            onChange={(e) => handleChange('street2', e.target.value)}
            placeholder={placeholders.street2}
            disabled={disabled}
            className={inputClasses}
          />
        </div>
      )}

      {/* City, State, Postal - row layout */}
      <div className={clsx(
        'grid gap-4',
        isCompact ? 'grid-cols-3' : 'grid-cols-1 md:grid-cols-3'
      )}>
        {/* City */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {labels.city}
            {required.includes('city') && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="text"
            value={value.city}
            onChange={(e) => handleChange('city', e.target.value)}
            placeholder={placeholders.city}
            disabled={disabled}
            className={clsx(inputClasses, errors.city && 'border-red-500')}
          />
          {errors.city && (
            <p className="mt-1 text-sm text-red-600">{errors.city}</p>
          )}
        </div>

        {/* State */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {stateLabel}
            {required.includes('state') && <span className="text-red-500 ml-1">*</span>}
          </label>
          {states.length > 0 ? (
            <select
              value={value.state}
              onChange={(e) => handleChange('state', e.target.value)}
              disabled={disabled}
              className={clsx(inputClasses, errors.state && 'border-red-500')}
            >
              <option value="">Select {stateLabel.toLowerCase()}</option>
              {states.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={value.state}
              onChange={(e) => handleChange('state', e.target.value)}
              placeholder={placeholders.state}
              disabled={disabled}
              className={clsx(inputClasses, errors.state && 'border-red-500')}
            />
          )}
          {errors.state && (
            <p className="mt-1 text-sm text-red-600">{errors.state}</p>
          )}
        </div>

        {/* Postal Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {postalLabel}
            {required.includes('postalCode') && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="text"
            value={value.postalCode}
            onChange={(e) => handleChange('postalCode', e.target.value)}
            placeholder={placeholders.postalCode}
            disabled={disabled}
            className={clsx(inputClasses, errors.postalCode && 'border-red-500')}
          />
          {errors.postalCode && (
            <p className="mt-1 text-sm text-red-600">{errors.postalCode}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 45.4: ADDRESS DISPLAY
// ============================================================================

/**
 * Formatted address display
 * 
 * @example
 * ```tsx
 * <AddressDisplay
 *   value={address}
 *   format="multi-line"
 *   showMapLink
 * />
 * ```
 */
export function AddressDisplay({
  value,
  format = 'single-line',
  showCopy = false,
  showMapLink = false,
  className,
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  if (!value) {
    return <span className={clsx('text-gray-400', className)}>-</span>;
  }

  const formatted = formatAddress(value, format);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={clsx('flex items-start gap-3', className)}>
      <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        {format === 'multi-line' ? (
          <div className="space-y-1">
            <p>{value.street1}</p>
            {value.street2 && <p>{value.street2}</p>}
            <p>
              {value.city}, {value.state} {value.postalCode}
            </p>
            <p>{getCountryData(value.country)?.name || value.country}</p>
          </div>
        ) : (
          <p>{formatted}</p>
        )}
      </div>

      {(showCopy || showMapLink) && (
        <div className="flex items-center gap-1">
          {showCopy && (
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              title="Copy address"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          )}
          {showMapLink && (
            <a
              href={getGoogleMapsUrl(value)}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 text-blue-500 hover:text-blue-600 rounded"
              title="Open in Maps"
            >
              <Map className="w-4 h-4" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ADDRESS CARD
// ============================================================================

interface AddressCardProps {
  value: AddressValue;
  label?: string;
  type?: 'home' | 'work' | 'shipping' | 'billing';
  isDefault?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onSetDefault?: () => void;
  className?: string;
}

/**
 * Address card with actions
 */
export function AddressCard({
  value,
  label,
  type = 'home',
  isDefault = false,
  onEdit,
  onDelete,
  onSetDefault,
  className,
}: AddressCardProps) {
  const icons = {
    home: Home,
    work: Building,
    shipping: MapPin,
    billing: MapPin,
  };

  const Icon = icons[type];

  return (
    <div className={clsx(
      'p-4 border rounded-lg',
      isDefault && 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
      className
    )}>
      <div className="flex items-start gap-3">
        <div className={clsx(
          'p-2 rounded-lg',
          isDefault ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
        )}>
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium capitalize">{label || type}</span>
            {isDefault && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                Default
              </span>
            )}
          </div>

          <AddressDisplay value={value} format="multi-line" />

          {(onEdit || onDelete || onSetDefault) && (
            <div className="flex items-center gap-3 mt-3 text-sm">
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Edit
                </button>
              )}
              {onSetDefault && !isDefault && (
                <button
                  type="button"
                  onClick={onSetDefault}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Set as default
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  COUNTRIES,
  getCountryData,
  EMPTY_ADDRESS,
};

// Types are exported inline at their definitions
