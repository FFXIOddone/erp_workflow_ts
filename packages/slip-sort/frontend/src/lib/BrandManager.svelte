<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { Button, Card, Modal, Input, Badge } from './components/ui';
  import { Plus, Pencil, Trash2, Settings, Tag, Store, Package } from 'lucide-svelte';
  import { toast } from './components/toast';

  // Accept brandId prop to avoid unknown prop warning from App.svelte
  export let brandId = 1;
  $: void brandId; // Reference to suppress unused warning

  /** @typedef {{id: number, name: string, code: string, description?: string, pattern_count?: number, store_count?: number, order_count?: number}} BM_Brand */

  const dispatch = createEventDispatcher();

  /** @type {BM_Brand[]} */
  let brands = [];
  let loading = true;
  /** @type {BM_Brand|null} */
  let editingBrand = null;
  let showAddForm = false;

  let newBrand = {
    name: '',
    code: '',
    description: '',
  };

  onMount(async () => {
    await loadBrands();
  });

  async function loadBrands() {
    loading = true;
    try {
      const res = await fetch('/api/brands');
      brands = await res.json();
    } catch (e) {
      console.error('Failed to load brands:', e);
      toast.error('Failed to load brands');
    }
    loading = false;
  }

  async function addBrand() {
    if (!newBrand.name || !newBrand.code) {
      toast.warning('Please provide name and code');
      return;
    }

    try {
      await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBrand),
      });

      toast.success(`Brand "${newBrand.name}" created`);
      newBrand = { name: '', code: '', description: '' };
      showAddForm = false;
      await loadBrands();
    } catch (e) {
      console.error('Failed to add brand:', e);
      toast.error('Failed to add brand');
    }
  }

  async function updateBrand() {
    if (!editingBrand) return;

    try {
      await fetch(`/api/brands/${editingBrand.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingBrand),
      });

      toast.success(`Brand "${editingBrand.name}" updated`);
      editingBrand = null;
      await loadBrands();
    } catch (e) {
      console.error('Failed to update brand:', e);
      toast.error('Failed to update brand');
    }
  }

  /** @param {BM_Brand} brand */
  async function deleteBrand(brand) {
    if (
      !confirm(
        `Delete brand "${brand.name}"? This will also delete all associated patterns, rules, and orders.`
      )
    ) {
      return;
    }

    try {
      await fetch(`/api/brands/${brand.id}`, {
        method: 'DELETE',
      });
      toast.success(`Brand "${brand.name}" deleted`);
      await loadBrands();
    } catch (e) {
      console.error('Failed to delete brand:', e);
      toast.error('Failed to delete brand');
    }
  }

  /** @param {BM_Brand} brand */
  function startEdit(brand) {
    editingBrand = { ...brand };
  }

  function cancelEdit() {
    editingBrand = null;
  }

  /** @param {BM_Brand} brand */
  function selectBrand(brand) {
    dispatch('selectBrand', brand.id);
  }
</script>

<div class="animate-fade-in">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Brand Manager</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Manage brands and their configurations</p>
    </div>
    <Button on:click={() => (showAddForm = true)}>
      <Plus size={18} />
      Add Brand
    </Button>
  </div>

  <!-- Add Brand Modal -->
  <Modal bind:open={showAddForm} title="Add New Brand" on:close={() => (showAddForm = false)}>
    <div class="space-y-4">
      <Input label="Brand Name" placeholder="e.g., Kwik Fill" bind:value={newBrand.name} required />

      <Input
        label="Brand Code"
        placeholder="e.g., KF"
        bind:value={newBrand.code}
        hint="Short code for file naming"
        required
      />

      <Input
        type="textarea"
        label="Description"
        placeholder="Optional description..."
        bind:value={newBrand.description}
      />
    </div>

    <svelte:fragment slot="footer">
      <div class="flex justify-end gap-3">
        <Button variant="secondary" on:click={() => (showAddForm = false)}>Cancel</Button>
        <Button on:click={addBrand}>Create Brand</Button>
      </div>
    </svelte:fragment>
  </Modal>

  <!-- Edit Brand Modal -->
  <Modal open={!!editingBrand} title="Edit Brand" on:close={cancelEdit}>
    {#if editingBrand}
      <div class="space-y-4">
        <Input label="Brand Name" bind:value={editingBrand.name} />

        <Input label="Brand Code" bind:value={editingBrand.code} />

        <Input type="textarea" label="Description" bind:value={editingBrand.description} />
      </div>
    {/if}

    <svelte:fragment slot="footer">
      <div class="flex justify-end gap-3">
        <Button variant="secondary" on:click={cancelEdit}>Cancel</Button>
        <Button on:click={updateBrand}>Save Changes</Button>
      </div>
    </svelte:fragment>
  </Modal>

  <!-- Brands Grid -->
  {#if loading}
    <div class="text-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
      <p class="text-gray-500 dark:text-gray-400 mt-2">Loading brands...</p>
    </div>
  {:else if brands.length === 0}
    <Card>
      <div class="p-12 text-center">
        <Tag size={48} class="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
        <h3 class="text-xl font-semibold mb-2 text-gray-900 dark:text-white">No Brands Yet</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-6">Get started by adding your first brand</p>
        <Button on:click={() => (showAddForm = true)}>
          <Plus size={18} />
          Add Brand
        </Button>
      </div>
    </Card>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each brands as brand}
        <Card hover>
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="text-xl font-bold text-gray-900 dark:text-white">{brand.name}</h3>
              {#if brand.code}
                <Badge variant="default" size="sm" class="mt-1">
                  {brand.code}
                </Badge>
              {/if}
            </div>
            <div class="flex gap-1">
              <button
                class="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                on:click={() => startEdit(brand)}
                aria-label="Edit brand"
              >
                <Pencil size={16} />
              </button>
              <button
                class="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                on:click={() => deleteBrand(brand)}
                aria-label="Delete brand"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {#if brand.description}
            <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">{brand.description}</p>
          {/if}

          <div class="grid grid-cols-3 gap-2 text-center text-sm mb-4">
            <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div class="font-semibold text-gray-900 dark:text-white">
                {brand.pattern_count || 0}
              </div>
              <div
                class="text-gray-500 dark:text-gray-400 text-xs flex items-center justify-center gap-1"
              >
                <Package size={12} />
                Patterns
              </div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div class="font-semibold text-gray-900 dark:text-white">
                {brand.store_count || 0}
              </div>
              <div
                class="text-gray-500 dark:text-gray-400 text-xs flex items-center justify-center gap-1"
              >
                <Store size={12} />
                Stores
              </div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div class="font-semibold text-gray-900 dark:text-white">
                {brand.order_count || 0}
              </div>
              <div
                class="text-gray-500 dark:text-gray-400 text-xs flex items-center justify-center gap-1"
              >
                <Tag size={12} />
                Orders
              </div>
            </div>
          </div>

          <Button variant="secondary" fullWidth on:click={() => selectBrand(brand)}>
            <Settings size={16} />
            Configure Brand
          </Button>
        </Card>
      {/each}
    </div>
  {/if}
</div>
