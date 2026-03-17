<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { X } from 'lucide-svelte';
  import Button from './Button.svelte';

  export let open = false;
  export let title = '';
  /** @type {'sm'|'md'|'lg'|'xl'|'full'} */
  export let size = 'md';
  export let closeOnClickOutside = true;
  export let closeOnEscape = true;
  export let showCloseButton = true;

  const dispatch = createEventDispatcher();

  /** @type {Record<'sm'|'md'|'lg'|'xl'|'full', string>} */
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw]',
  };

  function close() {
    dispatch('close');
  }

  /** @param {KeyboardEvent} e */
  function handleKeydown(e) {
    if (e.key === 'Escape' && closeOnEscape && open) {
      close();
    }
  }

  /** @param {MouseEvent} e */
  function handleBackdropClick(e) {
    if (e.target === e.currentTarget && closeOnClickOutside) {
      close();
    }
  }

  onMount(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeydown);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeydown);
    }
  });

  $: if (open && typeof document !== 'undefined') {
    document.body.style.overflow = 'hidden';
  } else if (typeof document !== 'undefined') {
    document.body.style.overflow = '';
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby={title ? 'modal-title' : undefined}
    transition:fade={{ duration: 150 }}
  >
    <!-- Backdrop (clickable to close) -->
    <button
      type="button"
      class="absolute inset-0 bg-black/50 dark:bg-black/70 cursor-default border-0"
      aria-label="Close modal"
      on:click={handleBackdropClick}
      on:keydown={handleKeydown}
    />

    <!-- Modal Content -->
    <div
      class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full {sizes[
        size
      ]} max-h-[90vh] overflow-hidden flex flex-col"
      transition:scale={{ duration: 200, start: 0.95 }}
    >
      <!-- Header -->
      {#if title || showCloseButton}
        <div
          class="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700"
        >
          {#if title}
            <h2 id="modal-title" class="text-xl font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
          {:else}
            <div></div>
          {/if}

          {#if showCloseButton}
            <Button variant="ghost" size="sm" on:click={close} aria-label="Close modal">
              <X size={20} />
            </Button>
          {/if}
        </div>
      {/if}

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-6">
        <slot />
      </div>

      <!-- Footer -->
      {#if $$slots.footer}
        <div
          class="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
        >
          <slot name="footer" />
        </div>
      {/if}
    </div>
  </div>
{/if}
