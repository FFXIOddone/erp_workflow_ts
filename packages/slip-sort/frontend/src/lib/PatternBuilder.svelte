<script>
  import { onMount } from 'svelte';
  import { Button, Card, Badge, Input, Modal } from './components/ui';
  import { toast } from './components/toast';
  import {
    FileText,
    Loader2,
    Save,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Plus,
    X,
    Grid,
    Upload,
    CheckCircle,
    Pencil,
  } from 'lucide-svelte';

  export let brandId = 1;

  /** @type {Array<{id: number, name: string, brand_id: number, pattern_type?: string, regions: Array<{x0: number, y0: number, x1: number, y1: number, field: string, type: string}>}>} */
  let patterns = [];
  /** @type {{id: number, name: string, brand_id: number, pattern_type?: string, regions: Array<{x0: number, y0: number, x1: number, y1: number, field: string, type: string}>}|null} */
  let selectedPattern = null;
  /** @type {{file_id: string, filename: string, page_count?: number}|null} */
  let uploadedPdf = null;
  /** @type {string|null} */
  let pageImage = null;
  let currentPage = 0;
  let totalPages = 0;
  let loading = false;

  // Region drawing state
  let isDrawing = false;
  /** @type {{x: number, y: number}|null} */
  let startPoint = null;
  /** @type {{x0: number, y0: number, x1: number, y1: number}|null} */
  let currentRect = null;
  /** @type {Array<{x0: number, y0: number, x1: number, y1: number, field: string, type: string}>} */
  let regions = [];
  /** @type {number|null} */
  let selectedRegionIndex = null;
  // Reserved for future use
  const _newFieldName = '';
  const _newFieldType = 'text';

  // Field name autocomplete
  let showFieldModal = false;
  /** @type {{x0: number, y0: number, x1: number, y1: number}|null} */
  let pendingRect = null;
  let fieldSearch = '';
  let showSuggestions = false;

  const suggestedFields = [
    'store_code',
    'store_name',
    'store_number',
    'sign_type',
    'promotion_name',
    'promotion_code',
    'quantity',
    'location',
    'class',
    'area',
    'size',
    'price',
    'description',
    'sku',
    'date',
    'notes',
  ];

  $: filteredSuggestions = suggestedFields.filter((f) =>
    f.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  // Canvas refs
  /** @type {HTMLDivElement} */
  let canvasContainer;
  /** @type {HTMLImageElement} */
  let imageElement;

  onMount(async () => {
    await loadPatterns();
  });

  async function loadPatterns() {
    try {
      const res = await fetch(`/api/patterns?brand_id=${brandId}`);
      patterns = await res.json();
    } catch (e) {
      console.error('Failed to load patterns:', e);
    }
  }

  /** @param {Event} e */
  async function uploadPdf(e) {
    const target = /** @type {HTMLInputElement} */ (e.target);
    const file = target.files?.[0];
    if (!file) return;

    loading = true;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/pdf/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      uploadedPdf = data;
      totalPages = data.page_count || 0;
      currentPage = 0;
      await loadPageImage();
      toast.success('PDF uploaded successfully');
    } catch (e) {
      console.error('Failed to upload PDF:', e);
      toast.error('Failed to upload PDF');
    }
    loading = false;
  }

  async function loadPageImage() {
    if (!uploadedPdf) return;

    loading = true;
    try {
      const res = await fetch(`/api/pdf/${uploadedPdf.file_id}/page/${currentPage}`);
      const data = await res.json();
      pageImage = `data:image/png;base64,${data.image}`;
    } catch (e) {
      console.error('Failed to load page:', e);
    }
    loading = false;
  }

  function nextPage() {
    if (currentPage < totalPages - 1) {
      currentPage++;
      loadPageImage();
    }
  }

  function prevPage() {
    if (currentPage > 0) {
      currentPage--;
      loadPageImage();
    }
  }

  // Convert mouse coordinates to percentage of image
  /** @param {MouseEvent} e */
  function getRelativeCoords(e) {
    if (!imageElement) return { x: 0, y: 0 };

    const rect = imageElement.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }

  /** @param {MouseEvent} e */
  function handleMouseDown(e) {
    if (e.button !== 0) return; // Left click only

    const coords = getRelativeCoords(e);
    isDrawing = true;
    startPoint = coords;
    currentRect = { x0: coords.x, y0: coords.y, x1: coords.x, y1: coords.y };
  }

  /** @param {MouseEvent} e */
  function handleMouseMove(e) {
    if (!isDrawing || !startPoint) return;

    const coords = getRelativeCoords(e);
    currentRect = {
      x0: Math.min(startPoint.x, coords.x),
      y0: Math.min(startPoint.y, coords.y),
      x1: Math.max(startPoint.x, coords.x),
      y1: Math.max(startPoint.y, coords.y),
    };
  }

  /** @param {MouseEvent} _e */
  function handleMouseUp(_e) {
    if (!isDrawing || !currentRect) return;

    isDrawing = false;

    // Only add if region is larger than 1%
    const width = currentRect.x1 - currentRect.x0;
    const height = currentRect.y1 - currentRect.y0;

    if (width > 0.01 && height > 0.01) {
      // Show modal for field name selection
      pendingRect = { ...currentRect };
      fieldSearch = '';
      showFieldModal = true;
    }

    currentRect = null;
    startPoint = null;
  }

  /** @param {number} index */
  function selectRegion(index) {
    selectedRegionIndex = index;
  }

  /** @param {number} index */
  function deleteRegion(index) {
    regions = regions.filter((_, i) => i !== index);
    if (selectedRegionIndex === index) {
      selectedRegionIndex = null;
    }
  }

  async function savePattern() {
    if (!selectedPattern && regions.length === 0) {
      toast.error('Draw at least one region first');
      return;
    }

    const name = prompt('Pattern name:', selectedPattern?.name || 'New Pattern');
    if (!name) return;

    const patternType = prompt('Pattern type (header, item_row, footer):', 'header');
    if (!patternType) return;

    try {
      if (selectedPattern) {
        // Update existing
        await fetch(`/api/patterns/${selectedPattern.id}/regions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(regions),
        });
      } else {
        // Create new
        await fetch('/api/patterns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand_id: brandId,
            name,
            pattern_type: patternType,
            regions,
          }),
        });
      }

      toast.success('Pattern saved!');
      await loadPatterns();
    } catch (e) {
      console.error('Failed to save pattern:', e);
      toast.error('Failed to save pattern');
    }
  }

  /** @param {{id: number, name: string, brand_id: number, pattern_type?: string, regions: Array<{x0: number, y0: number, x1: number, y1: number, field: string, type: string}>}} pattern */
  function loadPattern(pattern) {
    selectedPattern = pattern;
    regions = pattern.regions || [];
  }

  function clearRegions() {
    if (confirm('Clear all regions?')) {
      regions = [];
      selectedPattern = null;
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Pattern Builder</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">
        Define data extraction regions on PDF pages
      </p>
    </div>
  </div>

  <div class="grid grid-cols-12 gap-6">
    <!-- Left Panel: Patterns List -->
    <div class="col-span-3">
      <Card class="p-4">
        <h3 class="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Grid class="w-4 h-4 text-primary-600" />
          Saved Patterns
        </h3>

        {#if patterns.length === 0}
          <p class="text-sm text-gray-500 dark:text-gray-400">No patterns defined yet</p>
        {:else}
          <div class="space-y-2">
            {#each patterns as pattern}
              <button
                class="w-full text-left p-2 rounded border transition-colors
                       {selectedPattern?.id === pattern.id
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'}"
                on:click={() => loadPattern(pattern)}
              >
                <p class="font-medium text-sm text-gray-900 dark:text-white">{pattern.name}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Badge size="sm" variant="secondary">{pattern.pattern_type}</Badge>
                  <span>• {pattern.regions?.length || 0} regions</span>
                </p>
              </button>
            {/each}
          </div>
        {/if}

        <hr class="my-4 border-gray-200 dark:border-gray-700" />

        <h3 class="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Upload class="w-4 h-4 text-primary-600" />
          Upload PDF
        </h3>
        <input
          type="file"
          accept=".pdf"
          on:change={uploadPdf}
          class="text-sm text-gray-600 dark:text-gray-400"
        />

        {#if uploadedPdf}
          <p class="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
            <CheckCircle class="w-4 h-4" />
            {uploadedPdf.filename} ({totalPages} pages)
          </p>
        {/if}
      </Card>
    </div>

    <!-- Center: PDF Viewer with Region Drawing -->
    <div class="col-span-6">
      <Card class="overflow-hidden">
        {#if loading}
          <div class="h-96 flex items-center justify-center">
            <Loader2 class="w-12 h-12 animate-spin text-primary-600" />
          </div>
        {:else if pageImage}
          <!-- Page Navigation -->
          <div
            class="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-between"
          >
            <Button size="sm" variant="secondary" on:click={prevPage} disabled={currentPage === 0}>
              <ChevronLeft class="w-4 h-4 mr-1" />
              Prev
            </Button>
            <span class="text-sm text-gray-600 dark:text-gray-400"
              >Page {currentPage + 1} of {totalPages}</span
            >
            <Button
              size="sm"
              variant="secondary"
              on:click={nextPage}
              disabled={currentPage >= totalPages - 1}
            >
              Next
              <ChevronRight class="w-4 h-4 ml-1" />
            </Button>
          </div>

          <!-- Image with Region Overlays -->
          <div class="relative select-none cursor-crosshair" bind:this={canvasContainer}>
            <!-- Invisible interactive layer for drawing -->
            <div
              class="absolute inset-0 z-10"
              role="button"
              tabindex="-1"
              aria-label="Draw regions on PDF"
              on:mousedown={handleMouseDown}
              on:mousemove={handleMouseMove}
              on:mouseup={handleMouseUp}
              on:mouseleave={() => {
                isDrawing = false;
                currentRect = null;
              }}
            ></div>

            <img
              src={pageImage}
              alt="PDF Page"
              class="w-full"
              bind:this={imageElement}
              draggable="false"
            />

            <!-- Existing Regions -->
            {#each regions as region, index}
              <button
                type="button"
                class="region-overlay {selectedRegionIndex === index ? 'selected' : ''}"
                style="left: {region.x0 * 100}%; top: {region.y0 * 100}%; 
                       width: {(region.x1 - region.x0) * 100}%; height: {(region.y1 - region.y0) *
                  100}%;"
                on:click|stopPropagation={() => selectRegion(index)}
              >
                <span class="absolute -top-5 left-0 text-xs bg-primary-600 text-white px-1 rounded">
                  {region.field}
                </span>
              </button>
            {/each}

            <!-- Current Drawing -->
            {#if currentRect}
              <div
                class="absolute border-2 border-dashed border-green-500 bg-green-500/20 pointer-events-none"
                style="left: {currentRect.x0 * 100}%; top: {currentRect.y0 * 100}%; 
                       width: {(currentRect.x1 - currentRect.x0) * 100}%; height: {(currentRect.y1 -
                  currentRect.y0) *
                  100}%;"
              ></div>
            {/if}
          </div>
        {:else}
          <div class="h-96 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div class="text-center">
              <FileText class="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
              <p>Upload a PDF to start defining regions</p>
            </div>
          </div>
        {/if}
      </Card>
    </div>

    <!-- Right Panel: Region Details -->
    <div class="col-span-3">
      <Card class="p-4">
        <h3 class="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Pencil class="w-4 h-4 text-primary-600" />
          Defined Regions
        </h3>

        {#if regions.length === 0}
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Click and drag on the PDF to define data regions
          </p>
        {:else}
          <div class="space-y-2 max-h-80 overflow-y-auto">
            {#each regions as region, index}
              <div
                class="p-2 rounded border transition-colors {selectedRegionIndex === index
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700'}"
              >
                <div class="flex items-center justify-between">
                  <span class="font-medium text-sm text-gray-900 dark:text-white"
                    >{region.field}</span
                  >
                  <button
                    class="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1"
                    on:click={() => deleteRegion(index)}
                  >
                    <X class="w-4 h-4" />
                  </button>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Type: {region.type}
                </p>
              </div>
            {/each}
          </div>
        {/if}

        <hr class="my-4 border-gray-200 dark:border-gray-700" />

        <div class="space-y-2">
          <Button class="w-full" on:click={savePattern}>
            <Save class="w-4 h-4 mr-2" />
            Save Pattern
          </Button>
          <Button variant="secondary" class="w-full" on:click={clearRegions}>
            <Trash2 class="w-4 h-4 mr-2" />
            Clear All
          </Button>
        </div>

        <hr class="my-4 border-gray-200 dark:border-gray-700" />

        <div class="text-xs text-gray-500 dark:text-gray-400">
          <p class="font-medium mb-1 text-gray-700 dark:text-gray-300">Instructions:</p>
          <ol class="list-decimal list-inside space-y-1">
            <li>Upload a sample PDF</li>
            <li>Click and drag to draw a region</li>
            <li>Select or enter the field name</li>
            <li>Repeat for all data fields</li>
            <li>Save the pattern</li>
          </ol>
        </div>
      </Card>
    </div>
  </div>

  <!-- Field Name Selection Modal -->
  <Modal
    open={showFieldModal}
    title="Name This Region"
    on:close={() => {
      showFieldModal = false;
      pendingRect = null;
    }}
  >
    <div class="relative">
      <label
        class="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1"
        for="field-name-input">Field Name</label
      >
      <Input
        id="field-name-input"
        type="text"
        bind:value={fieldSearch}
        on:focus={() => (showSuggestions = true)}
        on:blur={() => setTimeout(() => (showSuggestions = false), 150)}
        placeholder="Type to search or enter custom..."
      />

      {#if showSuggestions && filteredSuggestions.length > 0}
        <div
          class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto"
        >
          {#each filteredSuggestions as suggestion}
            <button
              type="button"
              class="w-full text-left px-3 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-sm"
              on:mousedown|preventDefault={() => {
                fieldSearch = suggestion;
                showSuggestions = false;
              }}
            >
              <span class="font-mono text-primary-600 dark:text-primary-400">{suggestion}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
      Common fields: store_code, sign_type, quantity, promotion_name
    </p>

    <div slot="footer" class="flex justify-end gap-3">
      <Button
        variant="secondary"
        on:click={() => {
          showFieldModal = false;
          pendingRect = null;
        }}
      >
        <X class="w-4 h-4 mr-1" />
        Cancel
      </Button>
      <Button
        disabled={!fieldSearch.trim()}
        on:click={() => {
          if (fieldSearch.trim() && pendingRect) {
            regions = [
              ...regions,
              {
                field: fieldSearch.trim(),
                x0: pendingRect.x0,
                y0: pendingRect.y0,
                x1: pendingRect.x1,
                y1: pendingRect.y1,
                type: 'text',
              },
            ];
            toast.success(`Region "${fieldSearch.trim()}" added`);
          }
          showFieldModal = false;
          pendingRect = null;
          fieldSearch = '';
        }}
      >
        <Plus class="w-4 h-4 mr-1" />
        Add Region
      </Button>
    </div>
  </Modal>
</div>
