/**
 * File Upload Security Utilities
 * 
 * Centralized security validation for file uploads.
 * Part of Critical Improvement #6: File Upload Security Hardening
 * 
 * Usage:
 *   import { validateFile, sanitizeFilename, isImageFile } from '../lib/file-security.js';
 */

import path from 'path';
import crypto from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Blocked file extensions (executable/dangerous)
 */
export const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr',
  '.vbs', '.vbe', '.js', '.jse', '.ws', '.wsf', '.wsh',
  '.ps1', '.psd1', '.psm1', '.psc1', '.psc2',
  '.sh', '.bash', '.command',
  '.app', '.action', '.bin', '.cpl', '.csh',
  '.dll', '.so', '.dylib',
  '.inf', '.ins', '.inx', '.isu',
  '.job', '.lnk', '.mst', '.paf', '.pif', '.reg',
  '.rgs', '.sct', '.shb', '.shs', '.u3p',
  '.gadget', '.hta', '.htm', '.html', // Can contain scripts
  '.php', '.asp', '.aspx', '.jsp', '.cgi', // Server-side scripts
];

/**
 * Allowed image MIME types
 */
export const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/tiff',
  'image/bmp',
];

/**
 * Allowed document MIME types
 */
export const ALLOWED_DOCUMENT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
];

/**
 * Allowed design file MIME types (common in sign shops)
 */
export const ALLOWED_DESIGN_MIMES = [
  'application/postscript', // .ai, .eps
  'application/illustrator',
  'image/vnd.adobe.photoshop', // .psd
  'application/x-coreldraw', // .cdr
  'image/x-eps',
];

/**
 * All allowed MIME types
 */
export const ALL_ALLOWED_MIMES = [
  ...ALLOWED_IMAGE_MIMES,
  ...ALLOWED_DOCUMENT_MIMES,
  ...ALLOWED_DESIGN_MIMES,
];

/**
 * Maximum file sizes by category (in bytes)
 */
export const FILE_SIZE_LIMITS: Record<string, number> = {
  image: 10 * 1024 * 1024, // 10MB
  document: 25 * 1024 * 1024, // 25MB
  design: 100 * 1024 * 1024, // 100MB
  default: 50 * 1024 * 1024, // 50MB
  other: 50 * 1024 * 1024, // 50MB
};

// ============================================================================
// Validation Functions
// ============================================================================

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  category?: 'image' | 'document' | 'design' | 'other';
}

/**
 * Validate a file for upload
 */
export function validateFile(
  filename: string,
  mimetype: string,
  size?: number
): FileValidationResult {
  // Check extension blocklist
  const ext = path.extname(filename).toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `File extension "${ext}" is blocked for security reasons`,
    };
  }

  // Check for double extensions (e.g., file.pdf.exe)
  const parts = filename.split('.');
  if (parts.length > 2) {
    const secondToLast = '.' + parts[parts.length - 2].toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(secondToLast)) {
      return {
        valid: false,
        error: 'Suspicious double extension detected',
      };
    }
  }

  // Determine file category
  let category: FileValidationResult['category'] = 'other';
  if (ALLOWED_IMAGE_MIMES.includes(mimetype) || mimetype.startsWith('image/')) {
    category = 'image';
  } else if (ALLOWED_DOCUMENT_MIMES.includes(mimetype)) {
    category = 'document';
  } else if (ALLOWED_DESIGN_MIMES.includes(mimetype)) {
    category = 'design';
  }

  // Check MIME type
  if (!ALL_ALLOWED_MIMES.includes(mimetype) && !mimetype.startsWith('image/')) {
    return {
      valid: false,
      error: `File type "${mimetype}" is not allowed`,
    };
  }

  // Check file size
  if (size) {
    const sizeLimit = FILE_SIZE_LIMITS[category] || FILE_SIZE_LIMITS.default;
    if (size > sizeLimit) {
      const limitMB = Math.round(sizeLimit / 1024 / 1024);
      return {
        valid: false,
        error: `File size exceeds ${limitMB}MB limit for ${category} files`,
      };
    }
  }

  return { valid: true, category };
}

/**
 * Check if a file is an image
 */
export function isImageFile(mimetype: string): boolean {
  return ALLOWED_IMAGE_MIMES.includes(mimetype) || mimetype.startsWith('image/');
}

/**
 * Check if a file is a document
 */
export function isDocumentFile(mimetype: string): boolean {
  return ALLOWED_DOCUMENT_MIMES.includes(mimetype);
}

// ============================================================================
// Filename Sanitization
// ============================================================================

/**
 * Sanitize a filename for safe storage
 * - Removes path traversal attempts
 * - Removes dangerous characters
 * - Truncates to safe length
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  let sanitized = path.basename(filename);
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Replace dangerous characters
  sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  
  // Remove leading dots (hidden files)
  sanitized = sanitized.replace(/^\.+/, '');
  
  // Truncate to safe length (255 is common max)
  const ext = path.extname(sanitized);
  const name = path.basename(sanitized, ext);
  if (name.length + ext.length > 200) {
    sanitized = name.substring(0, 200 - ext.length) + ext;
  }
  
  // Fallback if empty
  if (!sanitized || sanitized === ext) {
    sanitized = 'file' + ext;
  }
  
  return sanitized;
}

/**
 * Generate a secure unique filename
 * Combines timestamp, random string, and original extension
 */
export function generateSecureFilename(originalFilename: string): string {
  const ext = path.extname(originalFilename).toLowerCase();
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${random}${ext}`;
}

/**
 * Generate a filename that preserves the original name but adds uniqueness
 */
export function generateUniqueFilename(originalFilename: string): string {
  const sanitized = sanitizeFilename(originalFilename);
  const ext = path.extname(sanitized);
  const name = path.basename(sanitized, ext);
  const timestamp = Date.now();
  return `${name}-${timestamp}${ext}`;
}

// ============================================================================
// Path Security
// ============================================================================

/**
 * Validate that a path is within a base directory (prevent path traversal)
 */
export function isPathWithinBase(basePath: string, filePath: string): boolean {
  const resolvedBase = path.resolve(basePath);
  const resolvedPath = path.resolve(basePath, filePath);
  return resolvedPath.startsWith(resolvedBase + path.sep);
}

/**
 * Get a safe file path within a base directory
 */
export function getSafeFilePath(basePath: string, filename: string): string | null {
  const sanitized = sanitizeFilename(filename);
  const fullPath = path.join(basePath, sanitized);
  
  if (!isPathWithinBase(basePath, fullPath)) {
    return null;
  }
  
  return fullPath;
}

export default {
  BLOCKED_EXTENSIONS,
  ALLOWED_IMAGE_MIMES,
  ALLOWED_DOCUMENT_MIMES,
  ALLOWED_DESIGN_MIMES,
  ALL_ALLOWED_MIMES,
  FILE_SIZE_LIMITS,
  validateFile,
  isImageFile,
  isDocumentFile,
  sanitizeFilename,
  generateSecureFilename,
  generateUniqueFilename,
  isPathWithinBase,
  getSafeFilePath,
};
