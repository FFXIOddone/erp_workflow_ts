import { writable } from 'svelte/store';

/**
 * Helper to create a persistent store that syncs with localStorage
 * @template T
 * @param {string} key - localStorage key
 * @param {T} initialValue - Initial value if no stored value exists
 * @returns {import('svelte/store').Writable<T>}
 */
function createPersistentStore(key, initialValue) {
  // Try to get initial value from localStorage
  let storedValue;
  try {
    const item = localStorage.getItem(key);
    storedValue = item ? JSON.parse(item) : initialValue;
  } catch (e) {
    storedValue = initialValue;
  }

  const store = writable(storedValue);

  // Subscribe to changes and save to localStorage
  store.subscribe((value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  });

  return store;
}

// Persistent settings stores
/** @type {import('svelte/store').Writable<string|null>} */
export const selectedBatchStore = createPersistentStore('slip_sort_selected_batch', /** @type {string|null} */ (null));
/** @type {import('svelte/store').Writable<string[]>} */
export const selectedWobblerKitsStore = createPersistentStore('slip_sort_wobbler_kits', /** @type {string[]} */ ([]));
export const blackoutRulesEnabledStore = createPersistentStore('slip_sort_blackout_enabled', {});
export const sortConfigEnabledStore = createPersistentStore('slip_sort_sort_enabled', true);
