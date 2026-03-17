/**
 * Formatting utilities for currency, numbers, and percentages
 */

/**
 * Format a number as USD currency
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount == null) return '-';
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(numAmount);
}

/**
 * Format a number with thousands separators
 */
export function formatNumber(value: number | string | null | undefined, options?: {
  decimals?: number;
  prefix?: string;
  suffix?: string;
}): string {
  if (value == null) return '-';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '-';
  
  const { decimals = 0, prefix = '', suffix = '' } = options || {};
  
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numValue);
  
  return `${prefix}${formatted}${suffix}`;
}

/**
 * Format a number as a percentage
 */
export function formatPercent(value: number | string | null | undefined, decimals = 1): string {
  if (value == null) return '-';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '-';
  
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numValue / 100);
}

/**
 * Format bytes as human-readable file size
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format duration in minutes as human-readable string
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return '-';
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
