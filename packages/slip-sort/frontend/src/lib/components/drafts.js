/**
 * Auto-save drafts utility
 * Provides localStorage-based draft saving with debouncing and conflict resolution.
 */

import { writable, get } from 'svelte/store';

const DRAFT_PREFIX = 'slipsort_draft_';
const DRAFT_INDEX_KEY = 'slipsort_draft_index';
const MAX_DRAFTS = 50;
const DRAFT_EXPIRY_DAYS = 7;

/**
 * Get all draft keys from localStorage
 */
function getDraftIndex() {
    try {
        const index = localStorage.getItem(DRAFT_INDEX_KEY);
        return index ? JSON.parse(index) : [];
    } catch {
        return [];
    }
}

/**
 * Update the draft index
 * @param {string[]} keys - Array of draft keys
 */
function updateDraftIndex(keys) {
    try {
        localStorage.setItem(DRAFT_INDEX_KEY, JSON.stringify(keys.slice(0, MAX_DRAFTS)));
    } catch {
        // Storage full, try to clean up
        cleanExpiredDrafts();
    }
}

/**
 * Remove expired drafts
 */
export function cleanExpiredDrafts() {
    const index = getDraftIndex();
    const now = Date.now();
    const expiryMs = DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    
    const validKeys = index.filter(/** @param {string} key */ key => {
        try {
            const stored = localStorage.getItem(DRAFT_PREFIX + key);
            const draft = stored ? JSON.parse(stored) : null;
            if (!draft || (now - draft.timestamp) > expiryMs) {
                localStorage.removeItem(DRAFT_PREFIX + key);
                return false;
            }
            return true;
        } catch {
            localStorage.removeItem(DRAFT_PREFIX + key);
            return false;
        }
    });
    
    updateDraftIndex(validKeys);
    return validKeys.length;
}

/**
 * @typedef {Object} DraftStoreOptions
 * @property {number} [debounceMs] - Debounce delay in milliseconds
 * @property {((data: any) => void)|null} [onSave] - Callback after save
 * @property {((data: any) => void)|null} [onLoad] - Callback after load
 * @property {((data: any, version: any) => void)|null} [onConflict] - Conflict resolution callback
 * @property {boolean} [autoLoad] - Auto-load on creation
 */

/**
 * Create an auto-saving draft store
 * 
 * @param {string} key - Unique identifier for this draft
 * @param {any} initialValue - Initial value if no draft exists
 * @param {DraftStoreOptions} options - Configuration options
 * @returns {Object} Store with save/load/clear methods
 */
export function createDraftStore(key, initialValue = {}, options = {}) {
    const {
        debounceMs = 1000,
        onSave = null,
        onLoad = null,
        onConflict = null,
        autoLoad = true,
    } = /** @type {DraftStoreOptions} */ (options);
    
    const fullKey = DRAFT_PREFIX + key;
    /** @type {ReturnType<typeof setTimeout>|null} */
    let saveTimeout = null;
    /** @type {Date|null} */
    let lastSaved = null;
    
    // Create the store
    const { subscribe, set, update } = writable(initialValue);
    
    // Status store for UI feedback
    /** @type {import('svelte/store').Writable<{isDirty: boolean, lastSaved: Date|null, hasLocalDraft: boolean, isSaving: boolean, error: string|null}>} */
    const status = writable({
        isDirty: false,
        lastSaved: null,
        hasLocalDraft: false,
        isSaving: false,
        error: null,
    });
    
    /**
     * Load draft from localStorage
     */
    function load() {
        try {
            const stored = localStorage.getItem(fullKey);
            if (stored) {
                const draft = JSON.parse(stored);
                
                // Check for conflicts (if there's a newer server version)
                if (onConflict && draft.serverVersion) {
                    // Let the caller handle conflict resolution
                    onConflict(draft.data, draft.serverVersion);
                } else {
                    set(draft.data);
                    status.update(s => ({ 
                        ...s, 
                        hasLocalDraft: true,
                        lastSaved: new Date(draft.timestamp)
                    }));
                    
                    if (onLoad) onLoad(draft.data);
                }
                
                return draft.data;
            }
        } catch (e) {
            status.update(s => ({ ...s, error: 'Failed to load draft' }));
            console.error('Failed to load draft:', e);
        }
        return null;
    }
    
    /**
     * Save draft to localStorage
     * @param {any} data - Data to save
     * @param {any} [serverVersion] - Optional server version for conflict detection
     */
    function save(data, serverVersion = null) {
        try {
            status.update(s => ({ ...s, isSaving: true }));
            
            const draft = {
                data,
                timestamp: Date.now(),
                serverVersion,
            };
            
            localStorage.setItem(fullKey, JSON.stringify(draft));
            lastSaved = new Date();
            
            // Update draft index
            const index = getDraftIndex();
            if (!index.includes(key)) {
                updateDraftIndex([key, ...index]);
            }
            
            status.update(s => ({ 
                ...s, 
                isDirty: false, 
                lastSaved,
                hasLocalDraft: true,
                isSaving: false,
                error: null,
            }));
            
            if (onSave) onSave(data);
            
            return true;
        } catch (e) {
            status.update(s => ({ 
                ...s, 
                isSaving: false,
                error: 'Failed to save draft'
            }));
            console.error('Failed to save draft:', e);
            return false;
        }
    }
    
    /**
     * Save with debouncing
     * @param {any} data - Data to save
     */
    function debouncedSave(data) {
        status.update(s => ({ ...s, isDirty: true }));
        
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        
        saveTimeout = setTimeout(() => {
            save(data);
        }, debounceMs);
    }
    
    /**
     * Clear the draft
     */
    function clear() {
        try {
            localStorage.removeItem(fullKey);
            
            const index = getDraftIndex();
            updateDraftIndex(index.filter(/** @param {string} k */ k => k !== key));
            
            status.update(s => ({ 
                ...s, 
                isDirty: false, 
                hasLocalDraft: false,
                lastSaved: null,
                error: null,
            }));
            
            return true;
        } catch (e) {
            console.error('Failed to clear draft:', e);
            return false;
        }
    }
    
    /**
     * Check if a draft exists
     */
    function exists() {
        return localStorage.getItem(fullKey) !== null;
    }
    
    /**
     * Get draft metadata without loading full data
     */
    function getMeta() {
        try {
            const stored = localStorage.getItem(fullKey);
            if (stored) {
                const draft = JSON.parse(stored);
                return {
                    timestamp: new Date(draft.timestamp),
                    hasServerVersion: !!draft.serverVersion,
                };
            }
        } catch {
            return null;
        }
        return null;
    }
    
    // Auto-load on creation if enabled
    if (autoLoad) {
        load();
    }
    
    return {
        subscribe,
        set: (/** @type {any} */ value) => {
            set(value);
            debouncedSave(value);
        },
        update: (/** @type {(current: any) => any} */ fn) => {
            update(current => {
                const newValue = fn(current);
                debouncedSave(newValue);
                return newValue;
            });
        },
        
        // Draft-specific methods
        load,
        save: () => save(get({ subscribe })),
        clear,
        exists,
        getMeta,
        status,
        
        // Force immediate save
        saveNow: () => {
            if (saveTimeout) clearTimeout(saveTimeout);
            return save(get({ subscribe }));
        },
    };
}

/**
 * List all available drafts
 * @returns {Array<{key: string, timestamp: Date, preview: string}|null>}
 */
export function listDrafts() {
    const index = getDraftIndex();
    
    return index.map(/** @param {string} key */ key => {
        try {
            const stored = localStorage.getItem(DRAFT_PREFIX + key);
            if (stored) {
                const draft = JSON.parse(stored);
                return {
                    key,
                    timestamp: new Date(draft.timestamp),
                    preview: typeof draft.data === 'object' 
                        ? JSON.stringify(draft.data).substring(0, 100) + '...'
                        : String(draft.data).substring(0, 100),
                };
            }
        } catch {
            return null;
        }
        return null;
    }).filter(Boolean);
}

/**
 * Delete a specific draft by key
 * @param {string} key - Draft key to delete
 * @returns {boolean}
 */
export function deleteDraft(key) {
    try {
        localStorage.removeItem(DRAFT_PREFIX + key);
        const index = getDraftIndex();
        updateDraftIndex(index.filter(/** @param {string} k */ k => k !== key));
        return true;
    } catch {
        return false;
    }
}

/**
 * Delete all drafts
 */
export function clearAllDrafts() {
    const index = getDraftIndex();
    index.forEach(/** @param {string} key */ key => {
        localStorage.removeItem(DRAFT_PREFIX + key);
    });
    localStorage.removeItem(DRAFT_INDEX_KEY);
}

// Clean expired drafts on module load
if (typeof window !== 'undefined') {
    cleanExpiredDrafts();
}
