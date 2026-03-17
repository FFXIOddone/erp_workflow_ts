<script>
  import { onMount, onDestroy } from 'svelte';
  import { selectedBatchStore, selectedWobblerKitsStore } from './stores.js';
  // UI components available for future use
  import { toast } from './components/toast';
  // Lucide icons available for future use

  // Accept brandId prop to avoid unknown prop warning from App.svelte
  export let brandId = 1;
  $: void brandId; // Reference to suppress unused warning

  /**
   * @typedef {{batch_id: string, started_at?: string, source_filename?: string, total_stores?: number, total_items?: number, total_pages?: number, status?: string}} GO_Batch
   * @typedef {{id: number, name: string, tiers?: Array<{name: string, field: string}>}} GO_SortConfig
   * @typedef {{id: number, name?: string, rule_type: string, condition_logic?: any, sign_type?: string, sign_version?: string}} GO_BlackoutRule
   * @typedef {{kit_name: string, store_count: number, items?: Array<any>}} GO_WobblerKit
   * @typedef {{id: number, name: string, target_type: string, target_value: string, styles: {background_color?: string, text_color?: string}, enabled: boolean}} GO_FormattingRule
   */

  /** @type {GO_Batch[]} */
  let batches = [];
  /** @type {string|null} */
  let selectedBatchId = null;
  /** @type {GO_Batch|null} */
  let selectedBatch = null;

  // Settings to apply
  /** @type {GO_SortConfig|null} */
  let sortConfig = null;
  /** @type {GO_BlackoutRule[]} */
  let blackoutRules = [];
  /** @type {GO_WobblerKit[]} */
  let wobblerKits = [];
  /** @type {Set<string>} */
  let selectedWobblerKits = new Set();
  /** @type {GO_FormattingRule[]} */
  let formattingRules = [];

  // Subscribe to stores for persistence
  /** @type {(() => void)|undefined} */
  let unsubBatch;
  /** @type {(() => void)|undefined} */
  let unsubWobblers;

  onMount(async () => {
    // Restore state from stores
    unsubBatch = selectedBatchStore.subscribe((val) => {
      if (val && !selectedBatchId) {
        selectedBatchId = val;
      }
    });

    unsubWobblers = selectedWobblerKitsStore.subscribe((val) => {
      if (val && val.length > 0) {
        selectedWobblerKits = new Set(val);
      }
    });

    await Promise.all([loadBatches(), loadSortConfig(), loadBlackoutRules(), loadFormattingRules()]);
  });

  onDestroy(() => {
    if (unsubBatch) unsubBatch();
    if (unsubWobblers) unsubWobblers();
  });

  // Save selections to stores when they change
  $: selectedBatchStore.set(selectedBatchId);
  $: selectedWobblerKitsStore.set(Array.from(selectedWobblerKits));

  let loading = true;
  let generating = false;
  /** @type {string|null} */
  let generatedPdfPath = null;

  async function loadBatches() {
    try {
      const res = await fetch('/api/batches?limit=50');
      batches = await res.json();
      if (batches.length > 0 && !selectedBatchId) {
        selectedBatchId = batches[0].batch_id;
        await onBatchChange();
      }
    } catch (e) {
      console.error('Failed to load batches:', e);
    }
    loading = false;
  }

  async function onBatchChange() {
    if (!selectedBatchId) return;

    selectedBatch = batches.find((b) => b.batch_id === selectedBatchId) || null;
    generatedPdfPath = null;

    // Load wobbler kits for this batch
    await loadWobblerKits();
  }

  async function loadSortConfig() {
    try {
      // API uses plural: /api/sort-configs with query param
      const res = await fetch('/api/sort-configs?brand_id=1');
      if (res.ok) {
        const configs = await res.json();
        // Get the first/default config
        sortConfig = configs.length > 0 ? configs[0] : null;
      }
    } catch (e) {
      console.error('Failed to load sort config:', e);
    }
  }

  async function loadBlackoutRules() {
    try {
      const res = await fetch('/api/blackout-rules?brand_id=1');
      blackoutRules = await res.json();
    } catch (e) {
      console.error('Failed to load blackout rules:', e);
      blackoutRules = [];
    }
  }

  async function loadFormattingRules() {
    try {
      const res = await fetch('/api/formatting-rules?brand_id=1');
      formattingRules = await res.json();
    } catch (e) {
      console.error('Failed to load formatting rules:', e);
      formattingRules = [];
    }
  }

  async function loadWobblerKits() {
    if (!selectedBatchId) return;

    try {
      const res = await fetch(`/api/batches/${selectedBatchId}/wobbler-kits`);
      const data = await res.json();
      wobblerKits = data.kits || [];

      // Pre-select kits that meet the threshold (10+ stores)
      selectedWobblerKits = new Set(
        wobblerKits.filter((k) => k.store_count >= 10).map((k) => k.kit_name)
      );
    } catch (e) {
      console.error('Failed to load wobbler kits:', e);
      wobblerKits = [];
    }
  }

  /** @param {string} kitName */
  function toggleWobblerKit(kitName) {
    if (selectedWobblerKits.has(kitName)) {
      selectedWobblerKits.delete(kitName);
    } else {
      selectedWobblerKits.add(kitName);
    }
    selectedWobblerKits = selectedWobblerKits;
  }

  // Reactive statement - recalculates whenever selectedWobblerKits or wobblerKits changes
  $: selectedKitsRenumbered = wobblerKits
    .filter((k) => selectedWobblerKits.has(k.kit_name))
    .map((kit, index) => ({
      original_name: kit.kit_name,
      new_number: index + 1,
      kit: kit,
    }));

  async function generateOutput() {
    if (!selectedBatchId) {
      toast.error('Please select a batch first');
      return;
    }

    generating = true;
    generatedPdfPath = null;

    try {
      // Build wobbler kit renumbering from reactive variable
      const kitRenumbering = selectedKitsRenumbered.map((k) => ({
        original_name: k.original_name,
        new_number: k.new_number,
      }));

      const res = await fetch(`/api/batches/${selectedBatchId}/generate-final-output`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apply_sort_config: true,
          apply_blackout_rules: true,
          wobbler_kit_names: Array.from(selectedWobblerKits),
          wobbler_kit_renumbering: kitRenumbering,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to generate output');
      }

      const result = await res.json();
      generatedPdfPath = result.output_path;

      const formatCount = result.formatting_applied || 0;
      toast.success(
        `Output generated! ${result.stores_processed} stores, ${result.blackouts_applied} blackouts${formatCount > 0 ? `, ${formatCount} highlights` : ''}`
      );
    } catch (e) {
      console.error('Failed to generate output:', e);
      toast.error('Failed to generate output: ' + (e instanceof Error ? e.message : 'Unknown error'));
    }

    generating = false;
  }

  async function downloadOutput() {
    if (!generatedPdfPath || !selectedBatchId) return;

    window.open(`/api/batches/${selectedBatchId}/download-output`, '_blank');
  }

  /** @param {string|undefined} dateStr */
  function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getConditionalRules() {
    return blackoutRules.filter((r) => r.rule_type === 'conditional');
  }

  function getCancelledItemRules() {
    return blackoutRules.filter((r) => r.rule_type === 'cancelled');
  }

  /** @param {GO_BlackoutRule} rule */
  function formatCondition(rule) {
    if (!rule.condition_logic) return 'Unknown condition';
    const logic =
      typeof rule.condition_logic === 'string'
        ? JSON.parse(rule.condition_logic)
        : rule.condition_logic;

    // Handle the actual structure: conditions/operator/target
    const conditions = Array.isArray(logic.conditions) ? logic.conditions : [];
    const target = logic.target || {};
    
    const ifPart = conditions
      .filter((/** @type {{field: string, value: string}} */ c) => c && c.value)
      .map((/** @type {{field: string, value: string}} */ c) => c.value)
      .join(` ${logic.operator || 'AND'} `) || '?';

    const thenPart = target.value || '?';

    return `IF ${ifPart} found → blackout ${thenPart}`;
  }
</script>

<div>
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Generate Output</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Generate sorted PDF with all settings applied</p>
    </div>

    <select bind:value={selectedBatchId} on:change={onBatchChange} class="input-field">
      <option value="">Select a batch...</option>
      {#each batches as batch}
        <option value={batch.batch_id}>
          {formatDate(batch.started_at)} — {batch.source_filename}
        </option>
      {/each}
    </select>
  </div>

  {#if loading}
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
      <p class="mt-4 text-gray-500 dark:text-gray-400">Loading...</p>
    </div>
  {:else if !selectedBatchId}
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
      <span class="text-5xl block mb-4">📄</span>
      <h3 class="text-xl font-semibold mb-2 dark:text-gray-100">No Batch Selected</h3>
      <p class="text-gray-500 dark:text-gray-400">Select a processing batch to generate output</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left Column: Settings Summary -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Batch Info -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 class="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-gray-100">
            <span class="text-xl">📦</span> Selected Batch
          </h2>
          {#if selectedBatch}
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-gray-500 dark:text-gray-400">Source File:</span>
                <span class="font-medium ml-2 dark:text-gray-200">{selectedBatch.source_filename}</span>
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400">Processed:</span>
                <span class="font-medium ml-2 dark:text-gray-200">{formatDate(selectedBatch.started_at)}</span>
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400">Total Pages:</span>
                <span class="font-medium ml-2 dark:text-gray-200">{selectedBatch.total_pages || 'N/A'}</span>
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400">Status:</span>
                <span
                  class="px-2 py-0.5 rounded text-xs font-medium ml-2
                      {selectedBatch.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'}"
                >
                  {selectedBatch.status}
                </span>
              </div>
            </div>
          {/if}
        </div>

        <!-- Sort Configuration -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 class="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-gray-100">
            <span class="text-xl">🔀</span> Sort Configuration
          </h2>
          {#if sortConfig}
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <span
                  class="w-3 h-3 rounded-full {(sortConfig.tiers?.length ?? 0) > 0
                    ? 'bg-green-500'
                    : 'bg-gray-300'}"
                ></span>
                <span class="text-sm"
                  >{(sortConfig.tiers?.length ?? 0) > 0
                    ? `${sortConfig.tiers?.length} sort tier(s) configured`
                    : 'No sort tiers'}</span
                >
              </div>
              {#if (sortConfig.tiers?.length ?? 0) > 0}
                <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p class="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-2">Sort Tiers</p>
                  <div class="flex flex-wrap gap-2">
                    {#each sortConfig.tiers || [] as tier, i}
                      <span class="px-2 py-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded text-sm dark:text-gray-200">
                        {i + 1}. {tier.name || tier.field || 'Tier ' + (i + 1)}
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {:else}
            <p class="text-gray-500 dark:text-gray-400 text-sm">
              No sort configuration found (will sort by store name)
            </p>
          {/if}
        </div>

        <!-- Blackout Rules -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 class="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-gray-100">
            <span class="text-xl">⬛</span> Blackout Rules
            <span class="text-sm font-normal text-gray-500 dark:text-gray-400">({blackoutRules.length} rules)</span>
          </h2>

          {#if blackoutRules.length === 0}
            <p class="text-gray-500 dark:text-gray-400 text-sm">No blackout rules configured</p>
          {:else}
            <div class="space-y-4">
              <!-- Conditional Rules -->
              {#if getConditionalRules().length > 0}
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-2">
                    Conditional Rules
                  </p>
                  <ul class="space-y-2">
                    {#each getConditionalRules() as rule}
                      <li class="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-900/30 rounded px-3 py-2">
                        <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span class="font-medium dark:text-gray-200">{rule.name}:</span>
                        <span class="text-gray-600 dark:text-gray-400">{formatCondition(rule)}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}

              <!-- Cancelled Item Rules -->
              {#if getCancelledItemRules().length > 0}
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-2">
                    Always Blackout (Cancelled Items)
                  </p>
                  <ul class="space-y-2">
                    {#each getCancelledItemRules() as rule}
                      <li class="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2">
                        <span class="w-2 h-2 rounded-full bg-gray-500"></span>
                        <span class="dark:text-gray-200">{rule.sign_type}</span>
                        {#if rule.sign_version}
                          <span class="text-gray-500 dark:text-gray-400">({rule.sign_version})</span>
                        {/if}
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Formatting Rules (Highlighting) -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 class="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-gray-100">
            <span class="text-xl">🎨</span> Formatting Rules
            <span class="text-sm font-normal text-gray-500 dark:text-gray-400">({formattingRules.filter(r => r.enabled).length} active)</span>
          </h2>

          {#if formattingRules.length === 0}
            <p class="text-gray-500 dark:text-gray-400 text-sm">No formatting rules configured</p>
          {:else}
            <div class="space-y-2">
              {#each formattingRules as rule}
                <div class="flex items-center gap-3 text-sm bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2">
                  <span 
                    class="w-4 h-4 rounded border"
                    style="background-color: {rule.styles?.background_color || '#ccc'};"
                  ></span>
                  <span class="font-medium {rule.enabled ? 'dark:text-gray-200' : 'text-gray-400 line-through'}">{rule.name}</span>
                  <span class="text-gray-500 dark:text-gray-400 text-xs truncate flex-1">→ "{rule.target_value}"</span>
                  <span class="text-xs px-1.5 py-0.5 rounded {rule.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}">
                    {rule.enabled ? 'ON' : 'OFF'}
                  </span>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Wobbler Kits -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 class="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-gray-100">
            <span class="text-xl">🏷️</span> Wobbler Kits
            <span class="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({selectedWobblerKits.size} of {wobblerKits.length} selected)
            </span>
          </h2>

          {#if wobblerKits.length === 0}
            <p class="text-gray-500 dark:text-gray-400 text-sm">No wobbler kits detected for this batch</p>
          {:else}
            <div class="space-y-3">
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Selected kits will be renumbered sequentially (1, 2, 3...) in the output.
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {#each wobblerKits as kit, _i}
                  {@const isSelected = selectedWobblerKits.has(kit.kit_name)}
                  {@const newNumber = selectedKitsRenumbered.find(
                    (k) => k.original_name === kit.kit_name
                  )?.new_number}

                  <label
                    class="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                           {isSelected
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      on:change={() => toggleWobblerKit(kit.kit_name)}
                      class="w-4 h-4 rounded border-gray-300 text-primary-600"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-medium">
                          Kit #{kit.kit_name}
                        </span>
                        {#if isSelected && newNumber}
                          <span class="text-xs px-2 py-0.5 rounded-full bg-primary-600 text-white">
                            → #{newNumber}
                          </span>
                        {/if}
                      </div>
                      <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {kit.store_count} stores • {kit.items?.length || 0} items
                      </p>
                    </div>
                    {#if kit.store_count >= 10}
                      <span class="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                        ✓
                      </span>
                    {/if}
                  </label>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Right Column: Generate Action -->
      <div class="space-y-6">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 sticky top-6">
          <h2 class="text-lg font-semibold mb-4 dark:text-gray-100">Generate Output PDF</h2>

          <div class="space-y-4">
            <!-- Summary -->
            <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Sort Config:</span>
                <span
                  class="font-medium {(sortConfig?.tiers?.length ?? 0) > 0
                    ? 'text-green-600'
                    : 'text-gray-400'}"
                >
                  {(sortConfig?.tiers?.length ?? 0) > 0 ? `${sortConfig?.tiers?.length} tier(s)` : 'Default'}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Blackout Rules:</span>
                <span class="font-medium dark:text-gray-200">{blackoutRules.length} rules</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Wobbler Kits:</span>
                <span class="font-medium dark:text-gray-200">{selectedWobblerKits.size} selected</span>
              </div>
            </div>

            <!-- Generate Button -->
            <button
              class="w-full btn-primary py-3 text-lg"
              on:click={generateOutput}
              disabled={generating}
            >
              {#if generating}
                <span class="flex items-center justify-center gap-2">
                  <span class="animate-spin">⏳</span>
                  Generating...
                </span>
              {:else}
                🚀 Generate Output PDF
              {/if}
            </button>

            <!-- Download Button (shown after generation) -->
            {#if generatedPdfPath}
              <button class="w-full btn-secondary py-3" on:click={downloadOutput}>
                📥 Download Output PDF
              </button>

              <p class="text-xs text-center text-green-600">✓ Output generated successfully</p>
            {/if}
          </div>
        </div>

        <!-- Info Box -->
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 class="font-semibold text-blue-900 dark:text-blue-300 mb-2">What happens when you generate?</h4>
          <ol class="text-sm text-blue-800 dark:text-blue-300 list-decimal list-inside space-y-1">
            <li>Pages sorted by configuration order</li>
            <li>Blackout rules applied to matching items</li>
            <li>Selected wobbler items blacked out</li>
            <li>Kit labels added (renumbered sequentially)</li>
            <li>Final PDF saved and ready for download</li>
          </ol>
        </div>
      </div>
    </div>
  {/if}
</div>
