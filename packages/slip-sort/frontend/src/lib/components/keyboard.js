/**
 * Keyboard Shortcuts Manager
 * Provides a unified way to handle keyboard shortcuts across the application
 */

// Lifecycle hooks available if needed
// import { onMount, onDestroy } from 'svelte';

/**
 * @typedef {Object} Shortcut
 * @property {string} key - The key to listen for (e.g., 'k', 'Escape', 'Enter')
 * @property {boolean} [ctrl] - Whether Ctrl key is required
 * @property {boolean} [meta] - Whether Meta (Cmd) key is required
 * @property {boolean} [shift] - Whether Shift key is required
 * @property {boolean} [alt] - Whether Alt key is required
 * @property {function} handler - The callback function
 * @property {string} [description] - Human-readable description
 */

/** @type {Map<string, Shortcut>} */
const shortcuts = new Map();

/** @type {Set<function>} */
const listeners = new Set();

/**
 * Generates a unique key for a shortcut
 * @param {Partial<Shortcut>} shortcut
 * @returns {string}
 */
function getShortcutKey(shortcut) {
  const parts = [];
  if (shortcut.ctrl) parts.push('ctrl');
  if (shortcut.meta) parts.push('meta');
  if (shortcut.alt) parts.push('alt');
  if (shortcut.shift) parts.push('shift');
  parts.push(shortcut.key?.toLowerCase() || '');
  return parts.join('+');
}

/**
 * Format shortcut for display
 * @param {Partial<Shortcut>} shortcut
 * @returns {string}
 */
export function formatShortcut(shortcut) {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
  const parts = [];
  if (shortcut.ctrl) parts.push(isMac ? '⌃' : 'Ctrl');
  if (shortcut.meta) parts.push(isMac ? '⌘' : 'Win');
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');
  if (shortcut.shift) parts.push(isMac ? '⇧' : 'Shift');
  parts.push(shortcut.key?.toUpperCase() || '');
  return parts.join(isMac ? '' : '+');
}

/**
 * Check if the event matches the shortcut
 * @param {KeyboardEvent} event
 * @param {Shortcut} shortcut
 * @returns {boolean}
 */
function matchesShortcut(event, shortcut) {
  // Guard against undefined key
  if (!shortcut.key || !event.key) {
    return false;
  }
  
  const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
  const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
  const metaMatch = !!shortcut.meta === event.metaKey;
  const shiftMatch = !!shortcut.shift === event.shiftKey;
  const altMatch = !!shortcut.alt === event.altKey;
  
  return keyMatch && ctrlMatch && shiftMatch && altMatch && (shortcut.ctrl || metaMatch);
}

/**
 * Global keyboard event handler
 * @param {KeyboardEvent} event
 */
function handleKeydown(event) {
  // Don't trigger shortcuts when typing in inputs
  const target = /** @type {HTMLElement} */ (event.target);
  const isInput = target.tagName === 'INPUT' || 
                  target.tagName === 'TEXTAREA' || 
                  target.isContentEditable;
  
  for (const shortcut of shortcuts.values()) {
    if (matchesShortcut(event, shortcut)) {
      // Allow Escape in inputs
      if (isInput && shortcut.key && shortcut.key.toLowerCase() !== 'escape') {
        continue;
      }
      
      event.preventDefault();
      event.stopPropagation();
      shortcut.handler(event);
      break;
    }
  }
}

// Initialize global listener
let initialized = false;

function ensureInitialized() {
  if (initialized || typeof window === 'undefined') return;
  window.addEventListener('keydown', handleKeydown);
  initialized = true;
}

/**
 * Register a keyboard shortcut
 * @param {Shortcut} shortcut
 * @returns {function} Cleanup function
 */
export function registerShortcut(shortcut) {
  ensureInitialized();
  const key = getShortcutKey(shortcut);
  shortcuts.set(key, shortcut);
  notifyListeners();
  
  return () => {
    shortcuts.delete(key);
    notifyListeners();
  };
}

/**
 * Get all registered shortcuts
 * @returns {Shortcut[]}
 */
export function getShortcuts() {
  return Array.from(shortcuts.values());
}

/**
 * Subscribe to shortcut changes
 * @param {function} callback
 * @returns {function} Unsubscribe function
 */
export function subscribeToShortcuts(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners() {
  listeners.forEach(fn => fn(getShortcuts()));
}

/**
 * Svelte action for keyboard shortcuts
 * Usage: <div use:shortcut={{ key: 'k', ctrl: true, handler: () => {} }}>
 * @param {HTMLElement} node
 * @param {Shortcut | Shortcut[]} shortcuts
 */
export function shortcut(node, shortcuts) {
  const shortcutArray = Array.isArray(shortcuts) ? shortcuts : [shortcuts];
  const cleanups = shortcutArray.map(s => registerShortcut(s));
  
  return {
    destroy() {
      cleanups.forEach(cleanup => cleanup());
    },
    /** @param {Shortcut | Shortcut[]} newShortcuts */
    update(newShortcuts) {
      cleanups.forEach(cleanup => cleanup());
      cleanups.length = 0;
      
      const newArray = Array.isArray(newShortcuts) ? newShortcuts : [newShortcuts];
      cleanups.push(...newArray.map(s => registerShortcut(s)));
    }
  };
}

/**
 * Default application shortcuts
 */
export const APP_SHORTCUTS = {
  SEARCH: { key: 'k', ctrl: true, description: 'Open quick search' },
  SAVE: { key: 's', ctrl: true, description: 'Save current item' },
  NEW: { key: 'n', ctrl: true, description: 'Create new item' },
  ESCAPE: { key: 'Escape', description: 'Close modal / Cancel' },
  HELP: { key: '?', shift: true, description: 'Show keyboard shortcuts' },
};
