<script>
  import { fly, fade } from 'svelte/transition';
  import Sidebar from './lib/Sidebar.svelte';
  import Dashboard from './lib/Dashboard.svelte';
  import ProcessPDF from './lib/ProcessPDF.svelte';
  import PatternBuilder from './lib/PatternBuilder.svelte';
  import SortConfig from './lib/SortConfig.svelte';
  import BlackoutConfig from './lib/BlackoutConfig.svelte';
  import GenerateOutput from './lib/GenerateOutput.svelte';
  import OrderHistory from './lib/OrderHistory.svelte';
  import BrandManager from './lib/BrandManager.svelte';
  import SelectiveFormatting from './lib/SelectiveFormatting.svelte';
  import WobblerKits from './lib/WobblerKits.svelte';
  import ToastProvider from './lib/components/ToastProvider.svelte';
  import ErrorBoundary from './lib/components/ErrorBoundary.svelte';
  import HelpModal from './lib/components/HelpModal.svelte';

  /** @typedef {'dashboard'|'process'|'patterns'|'sorting'|'blackout'|'generate'|'history'|'brands'|'formatting'|'wobblers'} ViewName */

  /** @type {ViewName} */
  let currentView = 'process';
  let selectedBrandId = 1;
  let viewKey = 0;
  let showHelp = false;

  /** @type {Record<ViewName, any>} */
  const views = {
    dashboard: Dashboard,
    process: ProcessPDF,
    patterns: PatternBuilder,
    sorting: SortConfig,
    blackout: BlackoutConfig,
    generate: GenerateOutput,
    history: OrderHistory,
    brands: BrandManager,
    formatting: SelectiveFormatting,
    wobblers: WobblerKits,
  };

  /**
   * @param {ViewName} view
   */
  function navigate(view) {
    if (view !== currentView) {
      currentView = view;
      viewKey++;
    }
  }

  /**
   * @param {number} brandId
   */
  function handleBrandSelect(brandId) {
    selectedBrandId = brandId;
    currentView = 'patterns';
    viewKey++;
  }

  /**
   * @param {CustomEvent} event
   */
  function handleError(event) {
    console.error('App Error:', event.detail);
  }

  function handleRetry() {
    viewKey++;
  }
</script>

<!-- Toast Notification Provider -->
<ToastProvider />

<!-- Help Modal -->
<HelpModal bind:isOpen={showHelp} {currentView} />

<div class="min-h-screen flex bg-gray-50 dark:bg-gray-900 transition-colors">
  <Sidebar {currentView} on:navigate={(e) => navigate(/** @type {ViewName} */ (e.detail))} />

  <main class="flex-1 p-6 overflow-auto">
    {#key viewKey}
      <div
        in:fly={{ x: 20, duration: 200, delay: 50 }}
        out:fade={{ duration: 100 }}
      >
        <ErrorBoundary
          fallbackMessage="Failed to load {currentView}"
          on:error={handleError}
          on:retry={handleRetry}
        >
          <svelte:component
            this={views[currentView]}
            brandId={selectedBrandId}
            on:brandChange={(/** @type {CustomEvent<number>} */ e) => (selectedBrandId = e.detail)}
            on:selectBrand={(/** @type {CustomEvent<number>} */ e) => handleBrandSelect(e.detail)}
            on:navigate={(/** @type {CustomEvent<ViewName>} */ e) => navigate(e.detail)}
          />
        </ErrorBoundary>
      </div>
    {/key}
  </main>
</div>
