<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { AlertTriangle, RefreshCw } from 'lucide-svelte';

  export let fallbackMessage = 'Something went wrong';
  export let showRetry = true;

  const dispatch = createEventDispatcher();

  let hasError = false;
  let errorMessage = '';
  let errorStack = '';

  // Handle errors at component level
  /** @param {Error|null|undefined} error */
  export function handleError(error) {
    hasError = true;
    errorMessage = error?.message || 'An unexpected error occurred';
    errorStack = error?.stack || '';
    console.error('ErrorBoundary caught:', error);
    dispatch('error', { error, message: errorMessage });
  }

  // Retry functionality
  function handleRetry() {
    hasError = false;
    errorMessage = '';
    errorStack = '';
    dispatch('retry');
  }

  // Global error handler for uncaught errors within the slot
  /** @type {((event: ErrorEvent) => void)|undefined} */
  let errorHandler;

  onMount(() => {
    /** @param {ErrorEvent} event */
    errorHandler = (event) => {
      if (event.error) {
        handleError(event.error);
        event.preventDefault();
      }
    };
    window.addEventListener('error', errorHandler);
  });

  onDestroy(() => {
    if (errorHandler) {
      window.removeEventListener('error', errorHandler);
    }
  });
</script>

{#if hasError}
  <div class="flex items-center justify-center min-h-[200px] p-8">
    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 max-w-md text-center">
      <div class="flex justify-center mb-4">
        <div class="p-3 bg-red-100 dark:bg-red-900/40 rounded-full">
          <AlertTriangle class="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
      </div>
      
      <h3 class="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
        {fallbackMessage}
      </h3>
      
      <p class="text-sm text-red-600 dark:text-red-400 mb-4">
        {errorMessage}
      </p>
      
      {#if showRetry}
        <button
          class="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          on:click={handleRetry}
        >
          <RefreshCw class="w-4 h-4" />
          Try Again
        </button>
      {/if}
      
      {#if errorStack}
        <details class="mt-4 text-left">
          <summary class="text-xs text-red-500 cursor-pointer hover:underline">
            Show Error Details
          </summary>
          <pre class="mt-2 p-2 bg-red-100 dark:bg-red-900/40 rounded text-xs overflow-auto max-h-40 text-red-700 dark:text-red-300">
            {errorStack}
          </pre>
        </details>
      {/if}
    </div>
  </div>
{:else}
  <slot />
{/if}
