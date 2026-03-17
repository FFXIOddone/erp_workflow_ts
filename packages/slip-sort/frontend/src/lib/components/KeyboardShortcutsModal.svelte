<script>
  import { onMount, onDestroy } from 'svelte';
  import { Modal } from './ui';
  import { Keyboard } from 'lucide-svelte';
  import { subscribeToShortcuts, getShortcuts, formatShortcut, registerShortcut } from './keyboard';

  let isOpen = false;
  /** @type {Array<{key: string, ctrl?: boolean, meta?: boolean, shift?: boolean, alt?: boolean, handler: function, description?: string}>} */
  let shortcuts = [];

  /** @type {function|undefined} */
  let unsubscribe;
  /** @type {function|undefined} */
  let cleanupShortcut;

  onMount(() => {
    shortcuts = getShortcuts();
    unsubscribe = subscribeToShortcuts((/** @type {Array<{key: string, ctrl?: boolean, meta?: boolean, shift?: boolean, alt?: boolean, handler: function, description?: string}>} */ updated) => {
      shortcuts = updated;
    });

    // Register ? to open this modal
    cleanupShortcut = registerShortcut({
      key: '?',
      shift: true,
      description: 'Show keyboard shortcuts',
      handler: () => {
        isOpen = true;
      }
    });
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
    if (cleanupShortcut) cleanupShortcut();
  });

  function close() {
    isOpen = false;
  }

  // Group shortcuts by category (simple grouping by modifier keys)
  $: groupedShortcuts = shortcuts.reduce((acc, s) => {
    let category = 'General';
    if (s.ctrl || s.meta) category = 'Actions';
    if (s.key === 'Escape') category = 'Navigation';
    
    if (!acc[category]) acc[category] = [];
    acc[category].push(s);
    return acc;
  }, /** @type {Record<string, typeof shortcuts>} */ ({}));
</script>

<Modal bind:open={isOpen} title="Keyboard Shortcuts" on:close={close}>
  <div class="space-y-6">
    {#if shortcuts.length === 0}
      <div class="text-center text-gray-500 dark:text-gray-400 py-8">
        <Keyboard class="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No keyboard shortcuts registered</p>
      </div>
    {:else}
      {#each Object.entries(groupedShortcuts) as [category, categoryShortcuts]}
        <div>
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            {category}
          </h3>
          <div class="space-y-2">
            {#each categoryShortcuts as shortcut}
              {#if shortcut.description}
                <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <span class="text-gray-700 dark:text-gray-300">{shortcut.description}</span>
                  <kbd class="inline-flex items-center gap-1 px-2 py-1 font-mono text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded shadow-sm">
                    {formatShortcut(shortcut)}
                  </kbd>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <div slot="footer" class="flex justify-end">
    <button
      class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      on:click={close}
    >
      Press <kbd class="px-1.5 py-0.5 mx-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 rounded">Esc</kbd> to close
    </button>
  </div>
</Modal>
