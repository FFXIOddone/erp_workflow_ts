<script>
  import { onMount } from 'svelte';
  import { Button, Card, Badge, Input, Modal, Select, Toggle } from './components/ui';
  import { toast } from './components/toast';
  import { 
    Palette, Type, Highlighter, Bold, Italic, Underline, 
    Plus, Trash2, Save, RefreshCw, Eye, EyeOff, Copy, Settings2
  } from 'lucide-svelte';

  // Accept brandId prop to avoid unknown prop warning from App.svelte
  export let brandId = 1;
  $: void brandId; // Reference to suppress unused warning

  /**
   * @typedef {{
   *   id: number,
   *   name: string,
   *   target_type: 'element'|'text_match'|'field',
   *   target_value: string,
   *   styles: FormattingStyles,
   *   enabled: boolean,
   *   priority: number
   * }} FormattingRule
   * 
   * @typedef {{
   *   background_color?: string,
   *   text_color?: string,
   *   font_size?: number,
   *   font_weight?: 'normal'|'bold',
   *   font_style?: 'normal'|'italic',
   *   text_decoration?: 'none'|'underline'|'line-through',
   *   border_color?: string,
   *   border_width?: number,
   *   opacity?: number
   * }} FormattingStyles
   */

  // Predefined color palette
  const colorPalette = [
    { name: 'Yellow', value: '#FFEB3B' },
    { name: 'Orange', value: '#FF9800' },
    { name: 'Red', value: '#F44336' },
    { name: 'Pink', value: '#E91E63' },
    { name: 'Purple', value: '#9C27B0' },
    { name: 'Blue', value: '#2196F3' },
    { name: 'Cyan', value: '#00BCD4' },
    { name: 'Green', value: '#4CAF50' },
    { name: 'Lime', value: '#CDDC39' },
    { name: 'Gray', value: '#9E9E9E' },
    { name: 'White', value: '#FFFFFF' },
    { name: 'Black', value: '#000000' },
  ];

  const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32];

  const targetTypes = [
    { value: 'element', label: 'PDF Element Type' },
    { value: 'text_match', label: 'Text Contains' },
    { value: 'field', label: 'Data Field' },
  ];

  // Available elements from processed batches
  /** @type {string[]} */
  let availableElements = ['store_header', 'item_row', 'page_footer', 'box_label', 'sign_type', 'sign_version'];
  
  /** @type {string[]} */
  let availableFields = ['store_code', 'store_name', 'sign_type', 'sign_version', 'quantity', 'kit_type', 'alcohol_type', 'state', 'box_category'];

  /** @type {FormattingRule[]} */
  let rules = [];
  let loading = true;
  let showAddModal = false;
  let showPreview = false;

  /** @type {FormattingRule|null} */
  let editingRule = null;

  // New rule form
  let newRule = getEmptyRule();

  function getEmptyRule() {
    return {
      name: '',
      target_type: /** @type {'element'|'text_match'|'field'} */ ('element'),
      target_value: '',
      styles: {
        background_color: '',
        text_color: '#000000',
        font_size: 12,
        font_weight: /** @type {'normal'|'bold'} */ ('normal'),
        font_style: /** @type {'normal'|'italic'} */ ('normal'),
        text_decoration: /** @type {'none'|'underline'|'line-through'} */ ('none'),
        border_color: '',
        border_width: 0,
        opacity: 100
      },
      enabled: true,
      priority: rules.length + 1
    };
  }

  async function loadRules() {
    loading = true;
    try {
      const res = await fetch('/api/formatting-rules');
      if (res.ok) {
        rules = await res.json();
      } else {
        // If endpoint doesn't exist yet, use empty array
        rules = [];
      }
    } catch (e) {
      console.error('Failed to load formatting rules:', e);
      rules = [];
    } finally {
      loading = false;
    }
  }

  async function loadAvailableFields() {
    try {
      const res = await fetch('/api/batches/field-suggestions');
      if (res.ok) {
        const data = await res.json();
        if (data.elements) availableElements = data.elements;
        if (data.fields) availableFields = data.fields;
      }
    } catch (e) {
      console.error('Failed to load field suggestions:', e);
    }
  }

  async function saveRule() {
    try {
      const ruleData = editingRule || newRule;
      const method = editingRule ? 'PUT' : 'POST';
      const url = editingRule 
        ? `/api/formatting-rules/${editingRule.id}` 
        : '/api/formatting-rules';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData)
      });

      if (res.ok) {
        toast.success(editingRule ? 'Rule updated' : 'Rule created');
        showAddModal = false;
        editingRule = null;
        newRule = getEmptyRule();
        await loadRules();
      } else {
        throw new Error('Failed to save rule');
      }
    } catch (e) {
      toast.error('Failed to save formatting rule');
      console.error(e);
    }
  }

  /**
   * @param {number} ruleId
   */
  async function deleteRule(ruleId) {
    if (!confirm('Delete this formatting rule?')) return;
    
    try {
      const res = await fetch(`/api/formatting-rules/${ruleId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        toast.success('Rule deleted');
        await loadRules();
      }
    } catch (e) {
      toast.error('Failed to delete rule');
    }
  }

  /**
   * @param {FormattingRule} rule
   */
  async function toggleRule(rule) {
    try {
      const res = await fetch(`/api/formatting-rules/${rule.id}/toggle`, {
        method: 'PUT'
      });

      if (res.ok) {
        rule.enabled = !rule.enabled;
        rules = rules;
      }
    } catch (e) {
      toast.error('Failed to toggle rule');
    }
  }

  /**
   * @param {FormattingRule} rule
   */
  function editRule(rule) {
    // @ts-ignore - spreading styles preserves the same type
    editingRule = { ...rule, styles: { ...rule.styles } };
    showAddModal = true;
  }

  /**
   * @param {FormattingRule} rule
   */
  function duplicateRule(rule) {
    newRule = {
      ...rule,
      name: `${rule.name} (copy)`,
      priority: rules.length + 1,
      styles: /** @type {typeof newRule.styles} */ ({ ...rule.styles })
    };
    // @ts-ignore - removing id for new rule
    delete newRule.id;
    showAddModal = true;
  }

  /**
   * Get preview styles for a rule
   * @param {FormattingStyles} styles
   */
  function getPreviewStyle(styles) {
    return `
      background-color: ${styles.background_color || 'transparent'};
      color: ${styles.text_color || 'inherit'};
      font-size: ${styles.font_size || 12}px;
      font-weight: ${styles.font_weight || 'normal'};
      font-style: ${styles.font_style || 'normal'};
      text-decoration: ${styles.text_decoration || 'none'};
      ${styles.border_color ? `border: ${styles.border_width || 1}px solid ${styles.border_color};` : ''}
      opacity: ${(styles.opacity || 100) / 100};
      padding: 4px 8px;
      border-radius: 4px;
    `;
  }

  onMount(() => {
    loadRules();
    loadAvailableFields();
  });

  $: currentRule = editingRule || newRule;
</script>

<div class="animate-fade-in">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Selective Formatting</h1>
      <p class="text-gray-600 dark:text-gray-400 mt-1">
        Customize colors, fonts, and styles for PDF elements
      </p>
    </div>
    <div class="flex gap-2">
      <Button variant="outline" on:click={() => showPreview = !showPreview}>
        {#if showPreview}
          <EyeOff size={16} />
        {:else}
          <Eye size={16} />
        {/if}
        {showPreview ? 'Hide' : 'Show'} Preview
      </Button>
      <Button on:click={() => { editingRule = null; newRule = getEmptyRule(); showAddModal = true; }}>
        <Plus size={16} />
        Add Rule
      </Button>
    </div>
  </div>

  <!-- Color Palette Quick Reference -->
  <Card class="mb-6">
    <div class="flex items-center gap-2 mb-3">
      <Palette size={20} class="text-purple-500" />
      <h3 class="font-semibold text-gray-900 dark:text-white">Color Palette</h3>
    </div>
    <div class="flex flex-wrap gap-2">
      {#each colorPalette as color}
        <button
          class="w-8 h-8 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
          style="background-color: {color.value}"
          title={color.name}
          on:click={() => {
            navigator.clipboard.writeText(color.value);
            toast.success(`Copied ${color.name}: ${color.value}`);
          }}
        />
      {/each}
    </div>
  </Card>

  <!-- Rules List -->
  {#if loading}
    <div class="text-center py-8 text-gray-500">Loading formatting rules...</div>
  {:else if rules.length === 0}
    <Card class="text-center py-12">
      <Highlighter size={48} class="mx-auto text-gray-400 mb-4" />
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Formatting Rules</h3>
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        Create rules to customize how elements appear in your sorted PDFs
      </p>
      <Button on:click={() => { newRule = getEmptyRule(); showAddModal = true; }}>
        <Plus size={16} />
        Create First Rule
      </Button>
    </Card>
  {:else}
    <div class="space-y-4">
      {#each rules as rule (rule.id)}
        <Card class="hover:shadow-md transition-shadow">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <Toggle 
                checked={rule.enabled} 
                on:change={() => toggleRule(rule)}
                label=""
              />
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-gray-900 dark:text-white">{rule.name}</h3>
                  <Badge variant={rule.target_type === 'element' ? 'default' : rule.target_type === 'text_match' ? 'warning' : 'success'}>
                    {rule.target_type.replace('_', ' ')}
                  </Badge>
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  Target: <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">{rule.target_value}</code>
                </p>
              </div>
            </div>

            <div class="flex items-center gap-3">
              {#if showPreview}
                <div 
                  class="px-3 py-1 text-sm"
                  style={getPreviewStyle(rule.styles)}
                >
                  Preview Text
                </div>
              {/if}

              <!-- Style indicators -->
              <div class="flex items-center gap-1">
                {#if rule.styles.background_color}
                  <div 
                    class="w-6 h-6 rounded border border-gray-300"
                    style="background-color: {rule.styles.background_color}"
                    title="Background: {rule.styles.background_color}"
                  />
                {/if}
                {#if rule.styles.text_color && rule.styles.text_color !== '#000000'}
                  <div 
                    class="w-6 h-6 rounded border border-gray-300 flex items-center justify-center"
                    style="color: {rule.styles.text_color}"
                    title="Text: {rule.styles.text_color}"
                  >
                    <Type size={14} />
                  </div>
                {/if}
                {#if rule.styles.font_weight === 'bold'}
                  <span title="Bold"><Bold size={16} class="text-gray-600" /></span>
                {/if}
                {#if rule.styles.font_style === 'italic'}
                  <span title="Italic"><Italic size={16} class="text-gray-600" /></span>
                {/if}
                {#if rule.styles.text_decoration === 'underline'}
                  <span title="Underline"><Underline size={16} class="text-gray-600" /></span>
                {/if}
              </div>

              <div class="flex gap-1">
                <button 
                  class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                  on:click={() => duplicateRule(rule)}
                  title="Duplicate"
                >
                  <Copy size={16} class="text-gray-500" />
                </button>
                <button 
                  class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                  on:click={() => editRule(rule)}
                  title="Edit"
                >
                  <Settings2 size={16} class="text-gray-500" />
                </button>
                <button 
                  class="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  on:click={() => deleteRule(rule.id)}
                  title="Delete"
                >
                  <Trash2 size={16} class="text-red-500" />
                </button>
              </div>
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>

<!-- Add/Edit Rule Modal -->
<Modal bind:open={showAddModal} title={editingRule ? 'Edit Formatting Rule' : 'Add Formatting Rule'} on:close={() => { showAddModal = false; editingRule = null; }}>
  <div class="space-y-6">
    <!-- Rule Name -->
    <div>
      <Input 
        bind:value={currentRule.name}
        placeholder="e.g., Highlight Alcohol Items"
        label="Rule Name"
      />
    </div>

    <!-- Target Type -->
    <div>
      <label for="target-type" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Target Type
      </label>
      <select
        id="target-type"
        bind:value={currentRule.target_type}
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
      >
        {#each targetTypes as type}
          <option value={type.value}>{type.label}</option>
        {/each}
      </select>
    </div>

    <!-- Target Value -->
    <div>
      <label for="target-value" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Target Value
      </label>
      {#if currentRule.target_type === 'element'}
        <select
          id="target-value"
          bind:value={currentRule.target_value}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
        >
          <option value="">Select an element...</option>
          {#each availableElements as element}
            <option value={element}>{element.replace(/_/g, ' ')}</option>
          {/each}
        </select>
      {:else if currentRule.target_type === 'field'}
        <select
          id="target-value"
          bind:value={currentRule.target_value}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
        >
          <option value="">Select a field...</option>
          {#each availableFields as field}
            <option value={field}>{field.replace(/_/g, ' ')}</option>
          {/each}
        </select>
      {:else}
        <Input 
          id="target-value"
          bind:value={currentRule.target_value}
          placeholder="e.g., Alcohol, CANCELLED"
        />
      {/if}
    </div>

    <!-- Styles Section -->
    <div class="border-t pt-4">
      <h4 class="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Palette size={18} />
        Styling Options
      </h4>

      <div class="grid grid-cols-2 gap-4">
        <!-- Background Color -->
        <div>
          <label for="bg-color" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Background Color
          </label>
          <div class="flex gap-2">
            <input 
              type="color"
              id="bg-color"
              bind:value={currentRule.styles.background_color}
              class="w-10 h-10 rounded cursor-pointer"
            />
            <Input 
              bind:value={currentRule.styles.background_color}
              placeholder="#FFEB3B"
              class="flex-1"
            />
          </div>
        </div>

        <!-- Text Color -->
        <div>
          <label for="text-color" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Text Color
          </label>
          <div class="flex gap-2">
            <input 
              type="color"
              id="text-color"
              bind:value={currentRule.styles.text_color}
              class="w-10 h-10 rounded cursor-pointer"
            />
            <Input 
              bind:value={currentRule.styles.text_color}
              placeholder="#000000"
              class="flex-1"
            />
          </div>
        </div>

        <!-- Font Size -->
        <div>
          <label for="font-size" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Font Size
          </label>
          <select
            id="font-size"
            bind:value={currentRule.styles.font_size}
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
          >
            {#each fontSizes as size}
              <option value={size}>{size}px</option>
            {/each}
          </select>
        </div>

        <!-- Opacity -->
        <div>
          <label for="opacity" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Opacity: {currentRule.styles.opacity}%
          </label>
          <input
            id="opacity"
            type="range" 
            min="10" 
            max="100" 
            bind:value={currentRule.styles.opacity}
            class="w-full"
          />
        </div>
      </div>

      <!-- Text Attributes -->
      <div class="mt-4">
        <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Text Attributes
        </span>
        <div class="flex gap-2">
          <button
            class="p-2 rounded-lg border {currentRule.styles.font_weight === 'bold' ? 'bg-blue-100 border-blue-500 dark:bg-blue-900' : 'border-gray-300 dark:border-gray-600'}"
            on:click={() => currentRule.styles.font_weight = currentRule.styles.font_weight === 'bold' ? 'normal' : 'bold'}
            title="Bold"
          >
            <Bold size={20} />
          </button>
          <button
            class="p-2 rounded-lg border {currentRule.styles.font_style === 'italic' ? 'bg-blue-100 border-blue-500 dark:bg-blue-900' : 'border-gray-300 dark:border-gray-600'}"
            on:click={() => currentRule.styles.font_style = currentRule.styles.font_style === 'italic' ? 'normal' : 'italic'}
            title="Italic"
          >
            <Italic size={20} />
          </button>
          <button
            class="p-2 rounded-lg border {currentRule.styles.text_decoration === 'underline' ? 'bg-blue-100 border-blue-500 dark:bg-blue-900' : 'border-gray-300 dark:border-gray-600'}"
            on:click={() => currentRule.styles.text_decoration = currentRule.styles.text_decoration === 'underline' ? 'none' : 'underline'}
            title="Underline"
          >
            <Underline size={20} />
          </button>
          <button
            class="p-2 rounded-lg border {currentRule.styles.text_decoration === 'line-through' ? 'bg-blue-100 border-blue-500 dark:bg-blue-900' : 'border-gray-300 dark:border-gray-600'}"
            on:click={() => currentRule.styles.text_decoration = currentRule.styles.text_decoration === 'line-through' ? 'none' : 'line-through'}
            title="Strikethrough"
          >
            <span class="line-through font-bold">S</span>
          </button>
        </div>
      </div>

      <!-- Border -->
      <div class="mt-4 grid grid-cols-2 gap-4">
        <div>
          <label for="border-color" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Border Color
          </label>
          <div class="flex gap-2">
            <input 
              type="color"
              id="border-color"
              bind:value={currentRule.styles.border_color}
              class="w-10 h-10 rounded cursor-pointer"
            />
            <Input 
              bind:value={currentRule.styles.border_color}
              placeholder="#000000"
              class="flex-1"
            />
          </div>
        </div>
        <div>
          <label for="border-width" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Border Width
          </label>
          <select
            id="border-width"
            bind:value={currentRule.styles.border_width}
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
          >
            {#each [0, 1, 2, 3, 4, 5] as width}
              <option value={width}>{width}px</option>
            {/each}
          </select>
        </div>
      </div>
    </div>

    <!-- Live Preview -->
    <div class="border-t pt-4">
      <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Live Preview
      </span>
      <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div style={getPreviewStyle(currentRule.styles)}>
          {currentRule.name || 'Sample Text Preview'}
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-2 pt-4 border-t">
      <Button variant="outline" on:click={() => { showAddModal = false; editingRule = null; }}>
        Cancel
      </Button>
      <Button on:click={saveRule} disabled={!currentRule.name || !currentRule.target_value}>
        <Save size={16} />
        {editingRule ? 'Update Rule' : 'Save Rule'}
      </Button>
    </div>
  </div>
</Modal>
