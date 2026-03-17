<script>
  import { onMount, onDestroy } from 'svelte';
  import { selectedBatchStore, selectedWobblerKitsStore } from './stores.js';
  import { Button, Card, Badge } from './components/ui';
  import Skeleton from './components/Skeleton.svelte';
  import { Package, Search, Info } from 'lucide-svelte';

  // Accept brandId prop to avoid unknown prop warning from App.svelte
  export let brandId = 1;
  $: void brandId; // Reference to suppress unused warning

  /** @type {{kit_name: string, store_count: number, sign_type?: string, sign_version?: string, items?: Array<{sign_type?: string, sign_version?: string, promo?: string, qty?: number}>, stores?: string[]}[]} */
  let wobblerKits = [];
  /** @type {{batch_id: string, upload_time?: string, started_at?: string, source_filename?: string, total_stores?: number}[]} */
  let batches = [];
  /** @type {string|null} */
  let selectedBatchId = null;
  let loading = true;
  // Reserved for future save functionality
  const _saving = false;

  // Kit selection state
  /** @type {Set<string>} */
  let selectedKits = new Set();

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
        selectedKits = new Set(val);
      }
    });

    await loadBatches();
  });

  onDestroy(() => {
    if (unsubBatch) unsubBatch();
    if (unsubWobblers) unsubWobblers();
  });

  // Save selections to stores when they change
  $: selectedBatchStore.set(selectedBatchId);
  $: selectedWobblerKitsStore.set(Array.from(selectedKits));

  async function loadBatches() {
    loading = true;
    try {
      const res = await fetch('/api/batches?limit=50');
      batches = await res.json();
      // Only auto-select if no batch was restored from store
      if (batches.length > 0 && !selectedBatchId) {
        selectedBatchId = batches[0].batch_id;
      }
      if (selectedBatchId) {
        await loadWobblerKits();
      }
    } catch (e) {
      console.error('Failed to load batches:', e);
    }
    loading = false;
  }

  async function loadWobblerKits() {
    if (!selectedBatchId) return;

    loading = true;
    try {
      const res = await fetch(`/api/batches/${selectedBatchId}/wobbler-kits`);
      const data = await res.json();
      wobblerKits = data.kits || [];

      // Only pre-select if no selections were restored from store
      if (selectedKits.size === 0) {
        selectedKits = new Set(
          wobblerKits.filter((k) => k.store_count >= 10).map((k) => k.kit_name)
        );
      }
    } catch (e) {
      console.error('Failed to load wobbler kits:', e);
      wobblerKits = [];
    }
    loading = false;
  }

  /** @param {string} kitName */
  function toggleKit(kitName) {
    if (selectedKits.has(kitName)) {
      selectedKits.delete(kitName);
    } else {
      selectedKits.add(kitName);
    }
    selectedKits = selectedKits; // Trigger reactivity
  }

  function selectAll() {
    selectedKits = new Set(wobblerKits.map((k) => k.kit_name));
  }

  function deselectAll() {
    selectedKits = new Set();
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
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Wobbler Kit Manager</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">
        Select wobbler kits for sorted PDFs — changes are saved automatically
      </p>
    </div>

    <div class="flex items-center gap-3">
      <select
        bind:value={selectedBatchId}
        on:change={loadWobblerKits}
        class="input-field dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      >
        <option value="">Select a batch...</option>
        {#each batches as batch}
          <option value={batch.batch_id}>
            {formatDate(batch.started_at)} — {batch.source_filename}
          </option>
        {/each}
      </select>
    </div>
  </div>

  {#if loading}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Skeleton variant="card" count={2} />
    </div>
  {:else if !selectedBatchId}
    <Card>
      <div class="p-12 text-center">
        <Package class="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Batch Selected</h3>
        <p class="text-gray-500 dark:text-gray-400">
          Select a processing batch to view its wobbler kits
        </p>
      </div>
    </Card>
  {:else if wobblerKits.length === 0}
    <Card>
      <div class="p-12 text-center">
        <Search class="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          No Wobbler Kits Found
        </h3>
        <p class="text-gray-500 dark:text-gray-400">
          This batch doesn't have any post-determined wobbler kit combinations
        </p>
        <p class="text-sm text-gray-400 dark:text-gray-500 mt-2">
          Wobbler kits are detected when 10+ stores share the same wobbler item combinations
        </p>
      </div>
    </Card>
  {:else}
    <!-- Info Banner -->
    <Card>
      <div class="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg -m-6 mb-0">
        <Info class="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <h4 class="font-semibold text-blue-900 dark:text-blue-300">How Wobbler Kits Work</h4>
          <p class="text-sm text-blue-800 dark:text-blue-400 mt-1">
            When selected kits are applied, the system will:
          </p>
          <ol
            class="text-sm text-blue-800 dark:text-blue-400 list-decimal list-inside mt-2 space-y-1"
          >
            <li>
              <strong>Black out</strong> the individual wobbler item rows on each store's order
            </li>
            <li>
              <strong>Add a kit label</strong> (e.g., "Kit #1") under the "Shelf Wobbler" sign type designation
            </li>
            <li><strong>Generate a kit appendix</strong> listing all wobbler items in each kit</li>
          </ol>
        </div>
      </div>
    </Card>

    <!-- Selection Controls -->
    <div class="flex items-center justify-between">
      <div class="text-sm text-gray-600 dark:text-gray-400">
        <strong>{wobblerKits.length}</strong> wobbler kit(s) detected •
        <strong>{selectedKits.size}</strong> selected
      </div>
      <div class="flex gap-2">
        <Button variant="secondary" size="sm" on:click={selectAll}>Select All</Button>
        <Button variant="secondary" size="sm" on:click={deselectAll}>Deselect All</Button>
      </div>
    </div>

    <!-- Kits Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {#each wobblerKits as kit}
        <Card clickable on:click={() => toggleKit(kit.kit_name)}>
          <div
            class={selectedKits.has(kit.kit_name)
              ? 'bg-primary-50 dark:bg-primary-900/20 -m-6 p-6 rounded-xl'
              : ''}
          >
            <div class="flex items-start justify-between mb-4">
              <div class="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedKits.has(kit.kit_name)}
                  on:click|stopPropagation
                  on:change={() => toggleKit(kit.kit_name)}
                  class="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <h3 class="text-lg font-bold text-gray-900 dark:text-white">
                    Kit #{kit.kit_name}
                  </h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {kit.store_count} stores • {kit.items?.length || 0} wobbler items
                  </p>
                </div>
              </div>

              <Badge variant={kit.store_count >= 10 ? 'success' : 'warning'}>
                {kit.store_count >= 10 ? 'Recommended' : 'Below Threshold'}
              </Badge>
            </div>

            <!-- Wobbler Items -->
            <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-4">
              <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Wobbler Items in Kit
              </h4>
              <ul class="space-y-1">
                {#each (kit.items || []).slice(0, 5) as item}
                  <li class="text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <span class="w-1.5 h-1.5 rounded-full bg-primary-500"></span>
                    <span class="truncate">{item.promo || 'Shelf Wobbler'}</span>
                    <span class="text-gray-400">×{item.qty || 1}</span>
                  </li>
                {/each}
                {#if (kit.items || []).length > 5}
                  <li class="text-sm text-gray-500 italic">
                    +{(kit.items || []).length - 5} more items...
                  </li>
                {/if}
              </ul>
            </div>

            <!-- Sample Stores -->
            <div>
              <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Sample Stores
              </h4>
              <div class="flex flex-wrap gap-1">
                {#each (kit.stores || []).slice(0, 8) as store}
                  <Badge variant="default" size="sm">{store}</Badge>
                {/each}
                {#if (kit.stores || []).length > 8}
                  <span class="px-2 py-0.5 text-gray-500 dark:text-gray-400 text-xs">
                    +{(kit.stores || []).length - 8} more
                  </span>
                {/if}
              </div>
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>
