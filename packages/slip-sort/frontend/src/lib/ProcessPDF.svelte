<script>
  import { Button, Card, Badge } from './components/ui';
  import { toast } from './components/toast';
  import {
    FileUp,
    FileText,
    CheckCircle,
    Package,
    Store,
    Box,
  } from 'lucide-svelte';

  export let brandId = 1;

  /** @type {File|null} */
  let file = null;
  /** @type {{file_id: string, filename: string, page_count?: number}|null} */
  let uploadedPdf = null;
  let processing = false;
  /** @type {{batch_id: string, total_stores: number, total_items: number, box_counts?: Record<string, number>, stores?: Array<{store_code: string, store_name: string, item_count: number}>}|null} */
  let result = null;
  /** @type {string|null} */
  let error = null;

  /**
   * @param {Event} e
   */
  async function handleFileSelect(e) {
    const target = /** @type {HTMLInputElement} */ (e.target);
    file = target.files?.[0] || null;
    error = null;
    result = null;

    if (!file) return;

    // Upload immediately
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/pdf/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      uploadedPdf = await res.json();
      toast.success('PDF uploaded successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      error = 'Failed to upload PDF: ' + message;
      toast.error(error);
      uploadedPdf = null;
    }
  }

  async function processPdf() {
    if (!uploadedPdf) return;

    processing = true;
    error = null;

    try {
      const res = await fetch(`/api/pdf/${uploadedPdf.file_id}/process?brand_id=${brandId}`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Processing failed');
      }

      result = await res.json();
      toast.success(`Processed ${result?.total_stores} stores with ${result?.total_items} items`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      error = 'Processing failed: ' + message;
      toast.error(error);
    }

    processing = false;
  }

  /**
   * @param {DragEvent} e
   */
  function handleDrop(e) {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      // @ts-ignore - We're simulating a file input event
      handleFileSelect({ target: { files } });
    }
  }

  /**
   * @param {DragEvent} e
   */
  function handleDragOver(e) {
    e.preventDefault();
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Process PDF</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Upload and process packing slip PDFs</p>
    </div>
  </div>

  {#if !result}
    <!-- Upload Area -->
    <Card>
      <div
        class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-12 text-center
               hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors cursor-pointer"
        role="button"
        tabindex="0"
        on:drop={handleDrop}
        on:dragover={handleDragOver}
        on:keydown={(e) => e.key === 'Enter' && document.getElementById('pdf-input')?.click()}
      >
        <input
          type="file"
          accept=".pdf"
          on:change={handleFileSelect}
          class="hidden"
          id="pdf-input"
        />

        <label for="pdf-input" class="cursor-pointer">
          <FileUp class="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
          <p class="text-xl font-medium text-gray-700 dark:text-gray-300">
            Drop PDF here or click to upload
          </p>
          <p class="text-gray-500 dark:text-gray-400 mt-2">
            Supports packing slip PDFs from configured brands
          </p>
        </label>
      </div>
    </Card>

    {#if uploadedPdf}
      <Card>
        <div class="flex items-center gap-4">
          <div class="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
            <CheckCircle class="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <div class="flex-1">
            <p class="font-semibold text-lg text-gray-900 dark:text-white">
              {uploadedPdf.filename}
            </p>
            <p class="text-gray-500 dark:text-gray-400">{uploadedPdf.page_count} pages</p>
          </div>
          <Button on:click={processPdf} disabled={processing} loading={processing}>
            {#if processing}
              Processing...
            {:else}
              <FileText class="w-4 h-4 mr-2" />
              Process PDF
            {/if}
          </Button>
        </div>
      </Card>
    {/if}

    {#if error}
      <div
        class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400"
      >
        {error}
      </div>
    {/if}
  {:else}
    <!-- Results -->
    <div class="space-y-6">
      <!-- Summary Card -->
      <Card>
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Processing Complete</h2>
          <Button
            variant="secondary"
            on:click={() => {
              result = null;
              uploadedPdf = null;
              file = null;
            }}
          >
            Process Another
          </Button>
        </div>

        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <Store class="w-8 h-8 mx-auto mb-2 text-primary-600 dark:text-primary-400" />
            <p class="text-3xl font-bold text-primary-600 dark:text-primary-400">
              {result.total_stores}
            </p>
            <p class="text-gray-500 dark:text-gray-400">Stores</p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <Package class="w-8 h-8 mx-auto mb-2 text-primary-600 dark:text-primary-400" />
            <p class="text-3xl font-bold text-primary-600 dark:text-primary-400">
              {result.total_items}
            </p>
            <p class="text-gray-500 dark:text-gray-400">Items</p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <Box class="w-8 h-8 mx-auto mb-2 text-primary-600 dark:text-primary-400" />
            <p class="text-3xl font-bold text-primary-600 dark:text-primary-400">
              {result.box_counts ? Object.keys(result.box_counts).length : 0}
            </p>
            <p class="text-gray-500 dark:text-gray-400">Box Types</p>
          </div>
        </div>

        <!-- Box Counts -->
        {#if result.box_counts}
          <div class="border-t dark:border-gray-700 pt-4">
            <h3 class="font-medium text-gray-900 dark:text-white mb-3">Box Distribution</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              {#each Object.entries(result.box_counts) as [box, count]}
                <div class="bg-primary-50 dark:bg-primary-900/30 rounded-lg p-3 text-center">
                  <p class="text-2xl font-bold text-primary-700 dark:text-primary-400">{count}</p>
                  <p class="text-sm text-primary-600 dark:text-primary-300">{box}</p>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </Card>

      <!-- Store List -->
      {#if result.stores && result.stores.length > 0}
        <Card>
          <div class="border-b dark:border-gray-700 pb-4 mb-4">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Extracted Stores</h2>
          </div>

          <div class="divide-y dark:divide-gray-700 max-h-96 overflow-y-auto">
            {#each result.stores as store (store.store_code)}
              <div
                class="py-4 first:pt-0 last:pb-0 hover:bg-gray-50 dark:hover:bg-gray-800 -mx-6 px-6"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">{store.store_code}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {store.item_count} items
                    </p>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </Card>
      {/if}
    </div>
  {/if}
</div>
