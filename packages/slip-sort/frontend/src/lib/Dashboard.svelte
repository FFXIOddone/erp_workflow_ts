<script>
  import { onMount } from 'svelte';
  import { Card, Badge } from './components/ui';
  import Skeleton from './components/Skeleton.svelte';
  import { Package, Store, Tag, FileText, RefreshCw } from 'lucide-svelte';
  import { toast } from './components/toast';

  // Accept brandId prop to avoid unknown prop warning from App.svelte
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export let brandId = 1;
  $: void brandId; // Reference to suppress unused warning

  /** @typedef {{batch_id: string, source_filename?: string, started_at?: string, total_stores?: number, total_items?: number, status?: string, box_counts?: Record<string, number>}} DB_Batch */

  /** @type {DB_Batch[]} */
  let recentBatches = [];
  let loading = true;
  const stats = {
    totalOrders: 0,
    totalStores: 0,
    brandsConfigured: 0,
  };

  async function loadData() {
    loading = true;
    try {
      const res = await fetch('/api/batches?limit=5');
      recentBatches = await res.json();

      const ordersRes = await fetch('/api/orders?limit=1');
      const ordersData = await ordersRes.json();
      stats.totalOrders = ordersData.total;

      const brandsRes = await fetch('/api/brands');
      const brands = await brandsRes.json();
      stats.brandsConfigured = brands.length;
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
      toast.error('Failed to load dashboard data');
    } finally {
      loading = false;
    }
  }

  onMount(loadData);
</script>

<div class="animate-fade-in">
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
    <button
      class="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
      on:click={loadData}
      aria-label="Refresh dashboard"
    >
      <RefreshCw size={20} class={loading ? 'animate-spin' : ''} />
    </button>
  </div>

  <!-- Stats Cards -->
  {#if loading}
    <Skeleton variant="stats" />
  {:else}
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
    <Card hover>
      <div class="flex items-center gap-4">
        <div class="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <Package class="text-blue-600 dark:text-blue-400" size={24} />
        </div>
        <div>
          <p class="text-gray-500 dark:text-gray-400 text-sm">Total Store Orders Processed</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.totalOrders.toLocaleString()}
          </p>
        </div>
      </div>
    </Card>

    <Card hover>
      <div class="flex items-center gap-4">
        <div class="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <Store class="text-green-600 dark:text-green-400" size={24} />
        </div>
        <div>
          <p class="text-gray-500 dark:text-gray-400 text-sm">Unique Stores</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.totalStores.toLocaleString()}
          </p>
        </div>
      </div>
    </Card>

    <Card hover>
      <div class="flex items-center gap-4">
        <div class="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
          <Tag class="text-purple-600 dark:text-purple-400" size={24} />
        </div>
        <div>
          <p class="text-gray-500 dark:text-gray-400 text-sm">Brands Configured</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{stats.brandsConfigured}</p>
        </div>
      </div>
    </Card>
  </div>
  {/if}

  <!-- Recent Processing -->
  <Card padding="none">
    <div class="p-4 border-b border-gray-100 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Processing Batches</h2>
    </div>

    {#if loading}
      <div class="p-4">
        <Skeleton variant="list" count={3} />
      </div>
    {:else if recentBatches.length === 0}
      <div class="p-8 text-center text-gray-500 dark:text-gray-400">
        <FileText size={48} class="mx-auto mb-2 opacity-50" />
        <p>No PDFs processed yet</p>
        <p class="text-sm mt-1">Upload a packing slip PDF to get started</p>
      </div>
    {:else}
      <div class="divide-y divide-gray-100 dark:divide-gray-700">
        {#each recentBatches as batch}
          <div class="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-gray-900 dark:text-white">{batch.source_filename}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {batch.total_stores} stores • {batch.total_items} items
                </p>
              </div>
              <div class="text-right">
                <Badge variant={batch.status === 'completed' ? 'success' : 'warning'} dot>
                  {batch.status}
                </Badge>
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {batch.started_at ? new Date(batch.started_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>

            {#if batch.box_counts && Object.keys(batch.box_counts).length > 0}
              <div class="mt-2 flex flex-wrap gap-2">
                {#each Object.entries(batch.box_counts) as [box, count]}
                  <Badge size="sm">{box}: {count}</Badge>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </Card>
</div>
