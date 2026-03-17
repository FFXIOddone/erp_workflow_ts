<script>
  import { onMount, onDestroy } from 'svelte';
  import { Button, Card, Toggle, Badge, Modal, Input, Select } from './components/ui';
  import { toast } from './components/toast';
  import {
    GripVertical,
    ChevronUp,
    ChevronDown,
    Trash2,
    Plus,
    RotateCcw,
    Save,
    Loader2,
    Layers,
    Lightbulb,
  } from 'lucide-svelte';

  export let brandId = 1;

  /**
   * @typedef {{id: string, label: string, order: number}} Category
   * @typedef {{name: string, field: string, enabled: boolean, categories: Category[]}} Tier
   * @typedef {{id: number|null, brand_id: number, name: string, is_default: boolean, tiers: Tier[]}} SortConfigType
   * @typedef {{name: string, label: string, values: string[]}} FieldSuggestion
   */

  /** @type {SortConfigType|null} */
  let sortConfig = null;
  let loading = true;
  let saving = false;
  /** @type {number|null} */
  let draggedTierIndex = null;
  // Reserved for future drag-and-drop functionality
  const _draggedCategoryIndex = null;
  const _draggedFromTier = null;

  // Field suggestions state
  /** @type {FieldSuggestion[]} */
  let fieldSuggestions = [];
  let loadingSuggestions = false;

  // Modal states
  let showAddTierModal = false;
  let showAddCategoryModal = false;
  /** @type {number|null} */
  let addCategoryTierIndex = null;
  
  // Add tier form
  let newTierName = '';
  let newTierField = '';
  
  // Add category form
  let newCategoryId = '';
  let newCategoryLabel = '';
  
  // Track if config has changed since last save
  let hasUnsavedChanges = false;
  /** @type {string|null} */
  let lastSavedSnapshot = null;
  
  // Auto-save debounce timer
  /** @type {ReturnType<typeof setTimeout>|null} */
  let autoSaveTimer = null;

  /** @type {Tier[]} */
  const defaultTiers = [
    {
      name: 'Box/Envelope Category',
      field: 'box_category',
      enabled: true,
      categories: [
        { id: '28x2x44', label: '28×2×44 (Large Items)', order: 1 },
        { id: '8x8x36', label: '8×8×36 (Banner Present)', order: 2 },
        { id: '8x8x30', label: '8×8×30 (Standard)', order: 3 },
        { id: 'Padded Envelope', label: 'Padded Envelope', order: 4 },
        { id: 'Padded Pack', label: 'Padded Pack', order: 5 },
        { id: 'Stay Flat Envelope', label: 'Stay Flat Envelope', order: 6 },
        { id: 'Manual Review', label: 'Manual Review', order: 99 },
      ],
    },
    {
      name: 'Kit Type',
      field: 'kit_type',
      enabled: true,
      categories: [
        { id: 'both', label: 'Counter + Shipper', order: 1 },
        { id: 'both_limited', label: 'Counter + Shipper (Limited)', order: 2 },
        { id: 'counter', label: 'Counter Only', order: 3 },
        { id: 'counter_limited', label: 'Counter Only (Limited)', order: 4 },
        { id: 'shipper', label: 'Shipper Only', order: 5 },
        { id: 'shipper_limited', label: 'Shipper Only (Limited)', order: 6 },
        { id: 'neither', label: 'No Counter/Shipper', order: 7 },
      ],
    },
    {
      name: 'Alcohol Type',
      field: 'alcohol_type',
      enabled: true,
      categories: [
        { id: 'alcohol', label: 'Alcohol', order: 1 },
        { id: 'non_alcohol', label: 'Non-Alcohol', order: 2 },
        { id: 'none', label: 'Neither', order: 3 },
      ],
    },
    {
      name: 'Location',
      field: 'state',
      enabled: true,
      categories: [
        { id: 'NY', label: 'New York', order: 1 },
        { id: 'PA', label: 'Pennsylvania', order: 2 },
        { id: 'OH', label: 'Ohio', order: 3 },
        { id: '_other', label: 'Other', order: 99 },
      ],
    },
    {
      name: 'Store Code',
      field: 'store_code',
      enabled: true,
      categories: [],
    },
  ];

  onMount(async () => {
    await Promise.all([loadConfig(), loadFieldSuggestions()]);
    
    // Handle page unload - save changes
    window.addEventListener('beforeunload', handleBeforeUnload);
  });
  
  onDestroy(() => {
    // Clean up
    window.removeEventListener('beforeunload', handleBeforeUnload);
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    
    // Auto-save on component destroy (tab navigation)
    if (hasUnsavedChanges && sortConfig && !saving) {
      saveConfigSilently();
    }
  });
  
  /**
   * Handle page unload - warn if unsaved changes
   * @param {BeforeUnloadEvent} e
   */
  function handleBeforeUnload(e) {
    if (hasUnsavedChanges) {
      // Try to save synchronously before unload
      saveConfigSilently();
    }
  }
  
  /**
   * Check if config has changed from last saved state
   */
  function checkForChanges() {
    if (!sortConfig) return;
    const currentSnapshot = JSON.stringify(sortConfig);
    hasUnsavedChanges = currentSnapshot !== lastSavedSnapshot;
    
    // Trigger debounced auto-save when changes detected
    if (hasUnsavedChanges) {
      triggerAutoSave();
    }
  }
  
  /**
   * Debounced auto-save - waits 2 seconds after last change
   */
  function triggerAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      if (hasUnsavedChanges && sortConfig && !saving) {
        saveConfigSilently();
      }
    }, 2000);
  }
  
  /**
   * Save config without showing toast (for auto-save)
   */
  async function saveConfigSilently() {
    if (!sortConfig || saving) return;
    saving = true;
    try {
      const method = sortConfig.id ? 'PUT' : 'POST';
      const url = sortConfig.id ? `/api/sort-configs/${sortConfig.id}` : '/api/sort-configs';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: brandId,
          name: sortConfig.name,
          is_default: sortConfig.is_default,
          tiers: sortConfig.tiers,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.id && !sortConfig.id) {
          sortConfig.id = data.id;
        }
        lastSavedSnapshot = JSON.stringify(sortConfig);
        hasUnsavedChanges = false;
      }
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
    saving = false;
  }
  
  // Reactive statement to detect changes
  $: if (sortConfig && !loading) {
    checkForChanges();
  }

  async function loadFieldSuggestions() {
    loadingSuggestions = true;
    try {
      const res = await fetch(`/api/batches/suggestions/fields?brand_id=${brandId}`);
      if (res.ok) {
        const data = await res.json();
        fieldSuggestions = data.fields || [];
      }
    } catch (e) {
      console.error('Failed to load field suggestions:', e);
    }
    loadingSuggestions = false;
  }

  /**
   * Get suggestions for a specific field
   * @param {string} fieldName
   * @returns {string[]}
   */
  function getSuggestionsForField(fieldName) {
    const field = fieldSuggestions.find(f => f.name === fieldName);
    return field?.values || [];
  }

  async function loadConfig() {
    loading = true;
    try {
      const res = await fetch(`/api/sort-configs?brand_id=${brandId}`);
      /** @type {SortConfigType[]} */
      const configs = await res.json();

      if (configs.length > 0) {
        sortConfig = configs.find((c) => c.is_default) || configs[0];
        
        // Check for new default tiers that don't exist in the saved config
        // and add them at the appropriate position
        const existingFields = new Set(sortConfig.tiers.map(t => t.field));
        for (let i = 0; i < defaultTiers.length; i++) {
          const defaultTier = defaultTiers[i];
          if (!existingFields.has(defaultTier.field)) {
            // Insert new tier at the default position
            sortConfig.tiers.splice(i, 0, JSON.parse(JSON.stringify(defaultTier)));
            console.log(`Added new tier "${defaultTier.name}" to config`);
          }
        }
      } else {
        // Create default
        sortConfig = {
          id: null,
          brand_id: brandId,
          name: 'Default Tiered Sort',
          is_default: true,
          tiers: JSON.parse(JSON.stringify(defaultTiers)),
        };
      }
    } catch (e) {
      console.error('Failed to load sort config:', e);
      sortConfig = {
        id: null,
        brand_id: brandId,
        name: 'Default Tiered Sort',
        is_default: true,
        tiers: JSON.parse(JSON.stringify(defaultTiers)),
      };
    }
    // Set initial snapshot after loading
    lastSavedSnapshot = JSON.stringify(sortConfig);
    hasUnsavedChanges = false;
    loading = false;
  }

  async function saveConfig() {
    if (!sortConfig) return;
    saving = true;
    try {
      const method = sortConfig.id ? 'PUT' : 'POST';
      const url = sortConfig.id ? `/api/sort-configs/${sortConfig.id}` : '/api/sort-configs';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: brandId,
          name: sortConfig.name,
          is_default: sortConfig.is_default,
          tiers: sortConfig.tiers,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.id && !sortConfig.id) {
          sortConfig.id = data.id;
        }
        lastSavedSnapshot = JSON.stringify(sortConfig);
        hasUnsavedChanges = false;
      }
      toast.success('Configuration saved!');
    } catch (e) {
      console.error('Failed to save:', e);
      toast.error('Failed to save configuration');
    }
    saving = false;
  }

  /**
   * @param {number} index
   * @param {number} direction
   */
  function moveTier(index, direction) {
    if (!sortConfig) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= sortConfig.tiers.length) return;

    const tiers = [...sortConfig.tiers];
    [tiers[index], tiers[newIndex]] = [tiers[newIndex], tiers[index]];
    sortConfig.tiers = tiers;
  }

  /**
   * @param {number} tierIndex
   * @param {number} catIndex
   * @param {number} direction
   */
  function moveCategory(tierIndex, catIndex, direction) {
    if (!sortConfig) return;
    const tier = sortConfig.tiers[tierIndex];
    const newIndex = catIndex + direction;
    if (newIndex < 0 || newIndex >= tier.categories.length) return;

    const cats = [...tier.categories];
    [cats[catIndex], cats[newIndex]] = [cats[newIndex], cats[catIndex]];

    // Update order numbers
    cats.forEach((c, i) => (c.order = i + 1));

    sortConfig.tiers[tierIndex].categories = cats;
    sortConfig = sortConfig; // trigger reactivity
  }

  /**
   * @param {number} index
   */
  function toggleTier(index) {
    if (!sortConfig) return;
    sortConfig.tiers[index].enabled = !sortConfig.tiers[index].enabled;
    sortConfig = sortConfig;
  }

  function openAddTierModal() {
    newTierName = '';
    newTierField = '';
    showAddTierModal = true;
  }

  function confirmAddTier() {
    if (!sortConfig || !newTierName || !newTierField) return;

    sortConfig.tiers = [
      ...sortConfig.tiers,
      {
        name: newTierName,
        field: newTierField,
        enabled: true,
        categories: [],
      },
    ];
    showAddTierModal = false;
    toast.success(`Added tier "${newTierName}"`);
  }

  /**
   * @param {number} index
   */
  function removeTier(index) {
    if (!sortConfig) return;
    if (!confirm('Remove this tier?')) return;
    sortConfig.tiers = sortConfig.tiers.filter((_, i) => i !== index);
  }

  /**
   * @param {number} tierIndex
   */
  function openAddCategoryModal(tierIndex) {
    addCategoryTierIndex = tierIndex;
    newCategoryId = '';
    newCategoryLabel = '';
    showAddCategoryModal = true;
  }

  function confirmAddCategory() {
    if (!sortConfig || addCategoryTierIndex === null || !newCategoryId) return;

    const tier = sortConfig.tiers[addCategoryTierIndex];
    const maxOrder = Math.max(0, ...tier.categories.map((c) => c.order || 0));

    tier.categories = [
      ...tier.categories,
      {
        id: newCategoryId,
        label: newCategoryLabel || newCategoryId,
        order: maxOrder + 1,
      },
    ];
    sortConfig = sortConfig;
    showAddCategoryModal = false;
    toast.success(`Added category "${newCategoryLabel || newCategoryId}"`);
  }

  /**
   * @param {number} tierIndex
   * @param {number} catIndex
   */
  function removeCategory(tierIndex, catIndex) {
    if (!sortConfig) return;
    sortConfig.tiers[tierIndex].categories = sortConfig.tiers[tierIndex].categories.filter(
      (_, i) => i !== catIndex
    );
    sortConfig = sortConfig;
  }

  function resetToDefault() {
    if (!sortConfig) return;
    if (!confirm('Reset to default configuration?')) return;
    sortConfig.tiers = JSON.parse(JSON.stringify(defaultTiers));
  }

  // Drag and drop for tiers
  /**
   * @param {DragEvent} e
   * @param {number} index
   */
  function handleTierDragStart(e, index) {
    draggedTierIndex = index;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  /**
   * @param {DragEvent} e
   * @param {number} index
   */
  function handleTierDragOver(e, index) {
    e.preventDefault();
    if (draggedTierIndex === null || draggedTierIndex === index) return;
  }

  /**
   * @param {DragEvent} e
   * @param {number} index
   */
  function handleTierDrop(e, index) {
    if (!sortConfig) return;
    e.preventDefault();
    if (draggedTierIndex === null || draggedTierIndex === index) return;

    const tiers = [...sortConfig.tiers];
    const [moved] = tiers.splice(draggedTierIndex, 1);
    tiers.splice(index, 0, moved);
    sortConfig.tiers = tiers;
    draggedTierIndex = null;
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Sort Configuration</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Configure tiered sorting for store orders</p>
    </div>
    <div class="flex gap-3">
      <Button variant="secondary" on:click={resetToDefault}>
        <RotateCcw class="w-4 h-4 mr-2" />
        Reset to Default
      </Button>
      <Button on:click={saveConfig} disabled={saving} loading={saving}>
        {#if saving}
          Saving...
        {:else}
          <Save class="w-4 h-4 mr-2" />
          Save Configuration
        {/if}
      </Button>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center h-64">
      <Loader2 class="w-12 h-12 animate-spin text-primary-600" />
    </div>
  {:else}
    <!-- Dynamic Sort Buckets Visualization -->
    <Card>
      <div
        class="p-4 bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg overflow-x-auto -m-6"
      >
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <Layers class="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">Sort Buckets</span>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            {#if sortConfig?.tiers}
              {@const enabledCount = sortConfig.tiers.filter(t => t.enabled).length}
              <span class="px-1.5 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 rounded text-xs">
                {enabledCount} tier{enabledCount !== 1 ? 's' : ''}
              </span>
            {/if}
          </div>
        </div>

        {#if sortConfig?.tiers}
          {@const enabledTiers = sortConfig.tiers.filter((t) => t.enabled)}
          {@const disabledTiers = sortConfig.tiers.filter((t) => !t.enabled)}

          {#if enabledTiers.length === 0}
            <div class="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
              <p>No tiers enabled</p>
            </div>
          {:else}
            <!-- Compact horizontal visualization -->
            <div class="sort-compact-flow">
              {#each enabledTiers as tier, tierIndex}
                <div class="compact-tier">
                  <div class="compact-tier-header">
                    <span class="compact-badge">T{tierIndex + 1}</span>
                    <span class="compact-name">{tier.name}</span>
                  </div>
                  <div class="compact-categories">
                    {#if tier.categories.length > 0}
                      {#each tier.categories.sort((a, b) => a.order - b.order).slice(0, 4) as cat, i}
                        <span class="compact-cat" style="--cat-hue: {(i * 60 + tierIndex * 90) % 360}">
                          {i + 1}. {cat.label.length > 12 ? cat.label.slice(0, 10) + '…' : cat.label}
                        </span>
                      {/each}
                      {#if tier.categories.length > 4}
                        <span class="compact-more">+{tier.categories.length - 4} more</span>
                      {/if}
                    {:else}
                      <span class="compact-cat alpha">A→Z</span>
                    {/if}
                  </div>
                </div>
                {#if tierIndex < enabledTiers.length - 1}
                  <span class="compact-arrow">→</span>
                {/if}
              {/each}
              <span class="compact-arrow">→</span>
              <span class="compact-output">📤</span>
            </div>

            <!-- Example bucket path -->
            <div class="example-bucket">
              <span class="example-label">Example bucket:</span>
              <div class="example-path">
                {#each enabledTiers as tier, tierIndex}
                  {@const firstCat = tier.categories.sort((a, b) => a.order - b.order)[0]}
                  <span class="example-node" style="--node-hue: {tierIndex * 90 % 360}">
                    T{tierIndex + 1}:{firstCat ? '1' : 'A'}
                  </span>
                  {#if tierIndex < enabledTiers.length - 1}
                    <span class="example-sep">›</span>
                  {/if}
                {/each}
              </div>
              <span class="example-desc">
                = {#each enabledTiers as tier, tierIndex}{@const firstCat = tier.categories.sort((a, b) => a.order - b.order)[0]}{firstCat ? firstCat.label : 'Alpha'}{#if tierIndex < enabledTiers.length - 1} → {/if}{/each}
              </span>
            </div>
          {/if}

          {#if disabledTiers.length > 0}
            <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">
              Disabled: {disabledTiers.map(t => t.name).join(', ')}
            </div>
          {/if}
        {/if}
      </div>
    </Card>

    <Card>
      <div
        class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 -m-6 mb-4"
      >
        <p class="text-blue-800 dark:text-blue-300">
          <strong>How it works:</strong> Orders are sorted by Tier 1 first, then within each Tier 1 group
          by Tier 2, and so on. Drag tiers to reorder priority. Use ▲▼ buttons to reorder categories within
          a tier.
        </p>
      </div>
    </Card>

    <div class="space-y-4">
      {#if sortConfig}
        {#each sortConfig.tiers as tier, tierIndex}
          <Card hover={false}>
            <div
              class={tier.enabled ? '' : 'opacity-60'}
              role="listitem"
              draggable="true"
              on:dragstart={(e) => handleTierDragStart(e, tierIndex)}
              on:dragover={(e) => handleTierDragOver(e, tierIndex)}
              on:drop={(e) => handleTierDrop(e, tierIndex)}
            >
              <!-- Tier Header -->
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-4">
                  <Badge variant="primary" size="lg">
                    Tier {tierIndex + 1}
                  </Badge>
                <GripVertical class="w-5 h-5 cursor-grab text-gray-400 dark:text-gray-500" />

                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{tier.name}</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Field: <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded"
                      >{tier.field}</code
                    >
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  on:click={() => moveTier(tierIndex, -1)}
                  disabled={tierIndex === 0}
                >
                  <ChevronUp class="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  on:click={() => moveTier(tierIndex, 1)}
                  disabled={tierIndex === sortConfig.tiers.length - 1}
                >
                  <ChevronDown class="w-4 h-4" />
                </Button>

                <Toggle
                  checked={tier.enabled}
                  on:change={() => toggleTier(tierIndex)}
                  label="Enabled"
                />

                <Button variant="ghost" size="sm" on:click={() => removeTier(tierIndex)}>
                  <Trash2 class="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>

            <!-- Categories -->
            {#if tier.categories.length > 0}
              <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium text-gray-600 dark:text-gray-400"
                    >Categories (sorted by order)</span
                  >
                  <Button variant="ghost" size="sm" on:click={() => openAddCategoryModal(tierIndex)}>
                    <Plus class="w-4 h-4 mr-1" />
                    Add Category
                  </Button>
                </div>

                <div class="space-y-1">
                  {#each tier.categories.sort((a, b) => a.order - b.order) as cat, catIndex}
                    <div class="category-row dark:bg-gray-700">
                      <span class="w-8 text-center font-mono text-gray-400">{cat.order}</span>
                      <input
                        type="text"
                        bind:value={cat.id}
                        class="w-24 px-2 py-1 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                        placeholder="ID"
                      />
                      <input
                        type="text"
                        bind:value={cat.label}
                        class="flex-1 px-2 py-1 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                        placeholder="Label"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        on:click={() => moveCategory(tierIndex, catIndex, -1)}
                        disabled={catIndex === 0}
                      >
                        <ChevronUp class="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        on:click={() => moveCategory(tierIndex, catIndex, 1)}
                        disabled={catIndex === tier.categories.length - 1}
                      >
                        <ChevronDown class="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        on:click={() => removeCategory(tierIndex, catIndex)}
                      >
                        <Trash2 class="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  {/each}
                </div>
              </div>
            {:else}
              <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                <p class="text-gray-500 dark:text-gray-400 text-sm mb-2">
                  No fixed categories — sorts alphabetically by field value
                </p>
                <Button variant="ghost" size="sm" on:click={() => openAddCategoryModal(tierIndex)}>
                  <Plus class="w-4 h-4 mr-1" />
                  Add Category
                </Button>
              </div>
            {/if}
          </div>
        </Card>
        {/each}
      {/if}
    </div>

    <div class="mt-4">
      <Button variant="secondary" on:click={openAddTierModal}>
        <Plus class="w-4 h-4 mr-2" />
        Add New Tier
      </Button>
    </div>
  {/if}
</div>

<!-- Add Tier Modal -->
<Modal open={showAddTierModal} title="Add New Tier" on:close={() => (showAddTierModal = false)}>
  <div class="space-y-4">
    <div>
      <Input bind:value={newTierName} placeholder="e.g., Location, Kit Type" label="Tier Name" />
    </div>
    
    <div>
      <Input bind:value={newTierField} placeholder="e.g., state, kit_type" label="Field Name" />
      
      {#if fieldSuggestions.length > 0}
        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mt-2">
          <div class="flex items-center gap-2 mb-2">
            <Lightbulb class="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span class="text-sm font-medium text-blue-700 dark:text-blue-300">Available Fields</span>
          </div>
          <div class="flex flex-wrap gap-2">
            {#each fieldSuggestions as field}
              <button
                type="button"
                class="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors"
                on:click={() => { newTierField = field.name; newTierName = field.label; }}
              >
                {field.label} ({field.values.length})
              </button>
            {/each}
          </div>
        </div>
      {:else if loadingSuggestions}
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading suggestions...</p>
      {/if}
    </div>
  </div>
  
  <div slot="footer" class="flex justify-end gap-3">
    <Button variant="secondary" on:click={() => (showAddTierModal = false)}>Cancel</Button>
    <Button variant="primary" on:click={confirmAddTier} disabled={!newTierName || !newTierField}>
      Add Tier
    </Button>
  </div>
</Modal>

<!-- Add Category Modal -->
<Modal open={showAddCategoryModal} title="Add Category" on:close={() => (showAddCategoryModal = false)}>
  <div class="space-y-4">
    {#if addCategoryTierIndex !== null && sortConfig}
      {@const tier = sortConfig.tiers[addCategoryTierIndex]}
      {@const suggestions = getSuggestionsForField(tier.field)}
      
      <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Adding category to: <span class="font-semibold text-gray-900 dark:text-white">{tier.name}</span>
        </p>
      </div>
      
      <div>
        <Input bind:value={newCategoryId} placeholder="e.g., NY, alcohol" label="Category ID" />
      </div>
      
      <div>
        <Input bind:value={newCategoryLabel} placeholder="e.g., New York, Alcohol Items" label="Display Label" />
      </div>
      
      {#if suggestions.length > 0}
        <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
          <div class="flex items-center gap-2 mb-2">
            <Lightbulb class="w-4 h-4 text-green-600 dark:text-green-400" />
            <span class="text-sm font-medium text-green-700 dark:text-green-300">
              Values from processed batches
            </span>
          </div>
          <div class="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {#each suggestions as value}
              <button
                type="button"
                class="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-700 transition-colors"
                on:click={() => { newCategoryId = value; newCategoryLabel = value; }}
              >
                {value}
              </button>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  </div>
  
  <div slot="footer" class="flex justify-end gap-3">
    <Button variant="secondary" on:click={() => (showAddCategoryModal = false)}>Cancel</Button>
    <Button variant="primary" on:click={confirmAddCategory} disabled={!newCategoryId}>
      Add Category
    </Button>
  </div>
</Modal>

<style>
  /* Compact Sort Visualization Styles */
  .sort-compact-flow {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding: 0.5rem 0;
  }

  .compact-tier {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    overflow: hidden;
    min-width: 100px;
    max-width: 160px;
  }

  :global(.dark) .compact-tier {
    background: #1e293b;
    border-color: #334155;
  }

  .compact-tier-header {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.5rem;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    font-size: 0.65rem;
  }

  .compact-badge {
    background: rgba(255, 255, 255, 0.3);
    padding: 0.1rem 0.25rem;
    border-radius: 0.2rem;
    font-weight: 700;
    font-size: 0.6rem;
  }

  .compact-name {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .compact-categories {
    padding: 0.35rem;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .compact-cat {
    font-size: 0.6rem;
    padding: 0.15rem 0.35rem;
    background: hsl(var(--cat-hue, 210), 70%, 95%);
    border-radius: 0.2rem;
    color: hsl(var(--cat-hue, 210), 60%, 30%);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(.dark) .compact-cat {
    background: hsl(var(--cat-hue, 210), 40%, 20%);
    color: hsl(var(--cat-hue, 210), 60%, 75%);
  }

  .compact-cat.alpha {
    background: #f1f5f9;
    color: #64748b;
    font-style: italic;
    text-align: center;
  }

  .compact-more {
    font-size: 0.55rem;
    color: #94a3b8;
    text-align: center;
    padding: 0.1rem;
  }

  .compact-arrow {
    color: #94a3b8;
    font-size: 0.9rem;
    font-weight: bold;
  }

  .compact-output {
    font-size: 1rem;
  }

  /* Example bucket path */
  .example-bucket {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: #f8fafc;
    border-radius: 0.375rem;
    border: 1px dashed #cbd5e1;
    flex-wrap: wrap;
  }

  :global(.dark) .example-bucket {
    background: #0f172a;
    border-color: #334155;
  }

  .example-label {
    font-size: 0.65rem;
    color: #64748b;
    font-weight: 500;
  }

  .example-path {
    display: flex;
    align-items: center;
    gap: 0.2rem;
  }

  .example-node {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.15rem 0.35rem;
    background: hsl(var(--node-hue, 210), 70%, 92%);
    color: hsl(var(--node-hue, 210), 70%, 35%);
    border-radius: 0.25rem;
    font-family: ui-monospace, monospace;
  }

  :global(.dark) .example-node {
    background: hsl(var(--node-hue, 210), 50%, 25%);
    color: hsl(var(--node-hue, 210), 70%, 80%);
  }

  .example-sep {
    color: #94a3b8;
    font-size: 0.7rem;
  }

  .example-desc {
    font-size: 0.6rem;
    color: #64748b;
    flex: 1;
    min-width: 150px;
  }

  :global(.dark) .example-desc {
    color: #94a3b8;
  }

  .category-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: white;
    padding: 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid #e5e7eb;
  }
</style>
