<script>
  import { onMount } from 'svelte';
  import { Button, Card, Badge, Input, Modal } from './components/ui';
  import Skeleton from './components/Skeleton.svelte';
  // Toast available for future notifications
  import { Search, Download, FileText, Loader2, Package, Store, X, Calendar } from 'lucide-svelte';

  // Accept brandId prop to avoid unknown prop warning from App.svelte
  export let brandId = 1;
  $: void brandId; // Reference to suppress unused warning

  /**
   * @typedef {{id: number, store_id: string, store_code?: string, store_name?: string, batch_id: string, kit_type?: string, item_count?: number, box_category?: string, processed_at?: string}} OH_Order
   * @typedef {{id?: number, batch_id: string, source_filename?: string, started_at?: string, total_stores?: number, processed_at?: string, total_pages?: number, store_count?: number}} OH_Batch
   * @typedef {{id: string, name: string}} OH_Store
   */

  /** @type {OH_Order[]} */
  let orders = [];
  /** @type {OH_Batch[]} */
  let batches = [];
  let loading = true;
  /** @type {OH_Batch|null} */
  let selectedBatch = null;
  let searchTerm = '';
  let filterStore = '';
  /** @type {OH_Store[]} */
  let stores = [];

  // PDF generation state
  /** @type {string|null} */
  let generatingBatchId = null;
  /** @type {Record<string, {output_path?: string}>} */
  const generationResult = {};
  /** @type {string|null} */
  let generationError = null;

  // Order details modal
  /** @type {OH_Order|null} */
  let selectedOrder = null;
  /** @type {Record<string, any>|null} */
  let orderDetails = null;
  let loadingDetails = false;

  onMount(async () => {
    await Promise.all([loadBatches(), loadStores()]);
  });

  async function loadBatches() {
    loading = true;
    try {
      const res = await fetch('/api/orders/history');
      const data = await res.json();
      batches = data.batches || [];
      orders = data.orders || [];
    } catch (e) {
      console.error('Failed to load history:', e);
    }
    loading = false;
  }

  async function loadStores() {
    try {
      const res = await fetch('/api/stores');
      stores = await res.json();
    } catch (e) {
      console.error('Failed to load stores:', e);
    }
  }

  /** @param {OH_Batch} batch */
  async function selectBatch(batch) {
    selectedBatch = batch;
    loading = true;
    try {
      const res = await fetch(`/api/orders?batch_id=${batch.batch_id}`);
      const data = await res.json();
      orders = data.orders || [];
    } catch (e) {
      console.error('Failed to load batch orders:', e);
      orders = [];
    }
    loading = false;
  }

  /** @param {string} batchId */
  async function generateSortedPdf(batchId) {
    generatingBatchId = batchId;
    generationError = null;

    try {
      const res = await fetch(`/api/batches/${batchId}/generate-sorted-pdf`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Generation failed');
      }

      const result = await res.json();
      generationResult[batchId] = result;
    } catch (e) {
      generationError = e instanceof Error ? e.message : 'Unknown error';
    }

    generatingBatchId = null;
  }

  /** @param {string} batchId */
  function downloadSortedPdf(batchId) {
    window.open(`/api/batches/${batchId}/download-sorted-pdf`, '_blank');
  }

  function clearBatchFilter() {
    selectedBatch = null;
    loadBatches();
  }

  /** @param {OH_Order} order */
  async function viewOrderDetails(order) {
    selectedOrder = order;
    loadingDetails = true;
    try {
      const res = await fetch(`/api/orders/${order.id}`);
      orderDetails = await res.json();
    } catch (e) {
      console.error('Failed to load order details:', e);
      orderDetails = null;
    }
    loadingDetails = false;
  }

  function closeOrderDetails() {
    selectedOrder = null;
    orderDetails = null;
  }

  $: filteredOrders = orders.filter((o) => {
    const matchesSearch =
      !searchTerm ||
      o.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.store_code?.includes(searchTerm);
    const matchesStore = !filterStore || String(o.store_id) === String(filterStore);
    return matchesSearch && matchesStore;
  });

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
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Order History</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">View and search past processing batches</p>
    </div>
    <Button variant="secondary" on:click={loadBatches}>
      <Calendar class="w-4 h-4 mr-2" />
      Refresh
    </Button>
  </div>

  <div class="grid grid-cols-12 gap-6">
    <!-- Batches Sidebar -->
    <div class="col-span-3">
      <Card class="sticky top-4">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Package class="w-4 h-4 text-primary-600" />
            Processing Batches
          </h2>
        </div>

        <div class="max-h-[600px] overflow-y-auto">
          {#if batches.length === 0}
            <div class="p-4 text-center text-gray-500 dark:text-gray-400">No batches yet</div>
          {:else}
            {#each batches as batch}
              <div
                class="border-b border-gray-200 dark:border-gray-700 {selectedBatch?.id === batch.id
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-l-primary-600'
                  : ''}"
              >
                <button
                  class="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  on:click={() => selectBatch(batch)}
                >
                  <div class="font-medium text-sm text-gray-900 dark:text-white">
                    {formatDate(batch.processed_at)}
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {batch.total_pages} pages • {batch.store_count} stores
                  </div>
                  <div class="text-xs text-gray-400 dark:text-gray-500 truncate mt-1">
                    {batch.source_filename}
                  </div>
                </button>

                <!-- Generate/Download Sorted PDF -->
                <div class="px-4 pb-3 flex flex-col gap-2">
                  {#if generationError && generatingBatchId === null}
                    <div
                      class="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded"
                    >
                      {generationError}
                    </div>
                  {/if}
                  {#if generationResult[batch.batch_id]}
                    <Button
                      size="sm"
                      variant="secondary"
                      class="w-full bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400"
                      on:click={(e) => {
                        e.stopPropagation();
                        downloadSortedPdf(batch.batch_id);
                      }}
                    >
                      <Download class="w-3 h-3 mr-1" />
                      Download
                    </Button>
                  {:else}
                    <Button
                      size="sm"
                      variant="secondary"
                      class="w-full"
                      disabled={generatingBatchId === batch.batch_id}
                      on:click={(e) => {
                        e.stopPropagation();
                        generateSortedPdf(batch.batch_id);
                      }}
                    >
                      {#if generatingBatchId === batch.batch_id}
                        <Loader2 class="w-3 h-3 mr-1 animate-spin" />
                        Generating...
                      {:else}
                        <FileText class="w-3 h-3 mr-1" />
                        Generate PDF
                      {/if}
                    </Button>
                  {/if}
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </Card>
    </div>

    <!-- Orders Table -->
    <div class="col-span-9">
      <Card>
        <!-- Filters -->
        <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4">
          {#if selectedBatch}
            <button
              class="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1"
              on:click={clearBatchFilter}
            >
              ← All Batches
            </button>
            <span class="text-gray-400 dark:text-gray-600">|</span>
          {/if}

          <div class="flex-1 relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              bind:value={searchTerm}
              placeholder="Search by store name or number..."
              class="pl-9 w-full max-w-md"
            />
          </div>

          <select
            bind:value={filterStore}
            class="input-field w-48 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          >
            <option value="">All Stores</option>
            {#each stores as store}
              <option value={store.id}>{store.name}</option>
            {/each}
          </select>
        </div>

        <!-- Results -->
        {#if loading}
          <div class="p-4">
            <table class="w-full">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th class="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Store</th>
                  <th class="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Kit Type</th>
                  <th class="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Items</th>
                  <th class="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Box</th>
                  <th class="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Processed</th>
                </tr>
              </thead>
              <tbody>
                <Skeleton variant="table-row" count={5} />
              </tbody>
            </table>
          </div>
        {:else if filteredOrders.length === 0}
          <div class="p-8 text-center text-gray-500 dark:text-gray-400">
            <Package class="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p>No orders found</p>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th
                    class="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300"
                    >Store</th
                  >
                  <th
                    class="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300"
                    >Kit Type</th
                  >
                  <th
                    class="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300"
                    >Items</th
                  >
                  <th
                    class="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300"
                    >Box</th
                  >
                  <th
                    class="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300"
                    >Processed</th
                  >
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                {#each filteredOrders as order}
                  <tr
                    class="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                    on:click={() => viewOrderDetails(order)}
                  >
                    <td class="px-4 py-3">
                      <div class="font-medium text-gray-900 dark:text-white">
                        {order.store_code}
                      </div>
                      <div class="text-sm text-gray-500 dark:text-gray-400">
                        {order.store_name || ''}
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      <Badge
                        variant={order.kit_type === 'counter'
                          ? 'info'
                          : order.kit_type === 'shipper'
                            ? 'success'
                            : order.kit_type === 'both'
                              ? 'default'
                              : 'secondary'}
                      >
                        {order.kit_type || 'N/A'}
                      </Badge>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {order.item_count || 0} items
                    </td>
                    <td class="px-4 py-3">
                      <Badge variant="warning">
                        {order.box_category || 'N/A'}
                      </Badge>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(order.processed_at)}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <div
            class="p-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400"
          >
            Showing {filteredOrders.length} orders
          </div>
        {/if}
      </Card>
    </div>
  </div>

  <!-- Order Details Modal -->
  <Modal
    open={!!selectedOrder}
    title="Order Details - {selectedOrder?.store_code || ''}"
    on:close={closeOrderDetails}
  >
    {#if loadingDetails}
      <div class="p-8 text-center">
        <Loader2 class="w-8 h-8 animate-spin text-primary-600 mx-auto" />
      </div>
    {:else if orderDetails}
      <div class="space-y-6">
        <!-- Order Summary -->
        <div class="grid grid-cols-3 gap-4">
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <div class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Store class="w-3 h-3" />
              Store
            </div>
            <div class="font-medium text-gray-900 dark:text-white">
              {orderDetails.order.store_code}
            </div>
          </div>
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <div class="text-sm text-gray-500 dark:text-gray-400">Kit Type</div>
            <div class="font-medium text-gray-900 dark:text-white capitalize">
              {orderDetails.order.kit_type}
            </div>
          </div>
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <div class="text-sm text-gray-500 dark:text-gray-400">Box Category</div>
            <div class="font-medium text-gray-900 dark:text-white">
              {orderDetails.order.box_category}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500 dark:text-gray-400">Alcohol:</span>
            <Badge
              variant={orderDetails.order.alcohol_type === 'alcohol' ? 'destructive' : 'secondary'}
            >
              {orderDetails.order.alcohol_type || 'none'}
            </Badge>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500 dark:text-gray-400">Banner:</span>
            <Badge variant={orderDetails.order.has_banner ? 'success' : 'secondary'}>
              {orderDetails.order.has_banner ? 'Yes' : 'No'}
            </Badge>
          </div>
        </div>

        <!-- Items Table -->
        <div>
          <h3 class="font-semibold mb-3 text-gray-900 dark:text-white">
            Items ({orderDetails.items.length})
          </h3>
          <table class="w-full text-sm">
            <thead class="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th class="px-3 py-2 text-left text-gray-600 dark:text-gray-300">Sign Type</th>
                <th class="px-3 py-2 text-left text-gray-600 dark:text-gray-300">Promotion</th>
                <th class="px-3 py-2 text-center text-gray-600 dark:text-gray-300">Qty</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              {#each orderDetails.items as item}
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td class="px-3 py-2 text-gray-900 dark:text-white">{item.sign_type}</td>
                  <td class="px-3 py-2 text-gray-900 dark:text-white">{item.promotion_name}</td>
                  <td class="px-3 py-2 text-center text-gray-900 dark:text-white"
                    >{item.quantity}</td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {:else}
      <div class="p-8 text-center text-gray-500 dark:text-gray-400">
        Failed to load order details
      </div>
    {/if}

    <div slot="footer" class="flex justify-end">
      <Button variant="secondary" on:click={closeOrderDetails}>
        <X class="w-4 h-4 mr-1" />
        Close
      </Button>
    </div>
  </Modal>
</div>
