<script>
  import { onMount } from 'svelte';
  import { Button, Card, Input } from './components/ui';
  import { toast } from './components/toast';
  import { Plus, Trash2, Pencil, Loader2, Ban, Filter, X, Save } from 'lucide-svelte';

  export let brandId = 1;

  /** @type {Array<{id: number, name: string, rule_type: string, is_enabled: boolean, sign_type?: string, sign_version?: string, condition_logic?: {conditions: Array<{field: string, value: string}>, operator: string, target: {field: string, value: string}}}>} */
  let rules = [];
  let loading = true;
  let activeTab = 'conditional'; // 'conditional' or 'cancelled'

  // Conditional rule builder state
  let conditionBuilder = {
    name: '',
    conditions: [{ field: 'item_contains', value: '' }],
    operator: 'AND',
    target: { field: 'item_contains', value: '' },
  };

  // Cancelled item state
  let cancelledItem = { sign_type: '', sign_version: '' };

  // Editing state
  /** @type {{id: number, name: string, rule_type: string, is_enabled: boolean, sign_type?: string, sign_version?: string, condition_logic?: {conditions: Array<{field: string, value: string}>, operator: string, target: {field: string, value: string}}}|null} */
  let editingRule = null;

  // Field options for conditions
  const fieldOptions = [
    { value: 'item_contains', label: 'Order contains item matching' },
    { value: 'sign_type_equals', label: 'Sign Type equals' },
    { value: 'sign_version_contains', label: 'Sign Version contains' },
    { value: 'promotion_contains', label: 'Promotion/Promo contains' },
    { value: 'has_kit_marker', label: 'Has kit marker' },
    { value: 'box_category_equals', label: 'Box Category equals' },
    { value: 'store_type_contains', label: 'Store Type contains' },
  ];

  // Common item/promotion suggestions - comprehensive list
  const itemSuggestions = [
    // Kit Markers
    '*CANDY; COUNTER KIT*',
    '*CANDY; SHIPPER KIT*',
    '*CANDY; LIMITED COUNTER KIT*',
    '*CANDY; LIMITED SHIPPER KIT*',
    '*Shelf Wobbler Kit; Alcohol Version*',
    '*Shelf Wobbler Kit; Non-Alcohol Version*',
    // Plain versions without asterisks
    'CANDY; COUNTER KIT',
    'CANDY; SHIPPER KIT',
    'CANDY; LIMITED COUNTER KIT',
    'CANDY; LIMITED SHIPPER KIT',
    'Shelf Wobbler Kit; Alcohol Version',
    'Shelf Wobbler Kit; Non-Alcohol Version',
    // Alcohol/Non-Alcohol identifiers
    'Alcohol Version',
    'Non-Alcohol Version',
    'Alcohol',
    'Non-Alcohol',
  ];

  // Sign type suggestions - comprehensive list
  const signTypeSuggestions = [
    'Shelf Wobbler',
    'Banner Sign',
    'Yard Sign',
    'A Frame',
    'A-Frame',
    'Bollard Cover',
    'Pole Sign Kit',
    'Pole Sign',
    'Windmaster',
    'Door Decal 24x36',
    'Door Sign 24x36',
    'Door Decal 24x6',
    'Window Sign',
    'Pump Topper',
    'Corner Cooler Cling',
    'Corner Cooler',
    'Starbursts',
    'Nozzle Talker',
    'Nozzle',
    'Poster',
    'Cling',
    'Decal',
    'Sign',
    'Counter Card',
    'Floor Graphic',
    'Hanging Sign',
    'Shelf Talker',
    'Header Card',
    'Standee',
    'Display',
  ];

  // Box category suggestions
  const boxCategorySuggestions = [
    '28x2x44',
    '8x8x36',
    '8x8x30',
    'Padded Envelope',
    'Padded Pack',
    'Stay Flat Envelope',
    'Manual Review',
  ];

  // Store type suggestions
  const storeTypeSuggestions = [
    'Alcohol Counter + Shipper',
    'Alcohol Counter',
    'Alcohol Shipper',
    'Alcohol No Counter/Shipper',
    'Non-Alcohol Counter + Shipper',
    'Non-Alcohol Counter',
    'Non-Alcohol Shipper',
    'Non-Alcohol No Counter/Shipper',
    'Counter + Shipper',
    'Counter',
    'Shipper',
    'No Counter/Shipper',
  ];

  /**
   * Get appropriate suggestions based on the selected field type
   * @param {string} fieldType - The field type from fieldOptions
   * @returns {string[]} Array of suggestions
   */
  function getSuggestionsForField(fieldType) {
    switch (fieldType) {
      case 'sign_type_equals':
        return signTypeSuggestions;
      case 'box_category_equals':
        return boxCategorySuggestions;
      case 'store_type_contains':
        return storeTypeSuggestions;
      case 'item_contains':
      case 'sign_version_contains':
      case 'promotion_contains':
      case 'has_kit_marker':
      default:
        return itemSuggestions;
    }
  }

  onMount(async () => {
    await loadRules();
  });

  async function loadRules() {
    loading = true;
    try {
      const res = await fetch(`/api/blackout-rules?brand_id=${brandId}`);
      rules = await res.json();
    } catch (e) {
      console.error('Failed to load rules:', e);
    }
    loading = false;
  }

  function addCondition() {
    conditionBuilder.conditions = [
      ...conditionBuilder.conditions,
      { field: 'item_contains', value: '' },
    ];
  }

  /** @param {number} index */
  function removeCondition(index) {
    conditionBuilder.conditions = conditionBuilder.conditions.filter((_, i) => i !== index);
  }

  function resetConditionBuilder() {
    conditionBuilder = {
      name: '',
      conditions: [{ field: 'item_contains', value: '' }],
      operator: 'AND',
      target: { field: 'item_contains', value: '' },
    };
    editingRule = null;
  }

  async function saveConditionalRule() {
    // Validate conditions - filter out any that are missing required fields
    const validConditions = conditionBuilder.conditions.filter((c) => c && c.field && c.value);
    
    if (validConditions.length === 0 || !conditionBuilder.target.value) {
      toast.error('Please fill in all condition fields');
      return;
    }
    
    // Ensure target has required fields
    const target = {
      field: conditionBuilder.target.field || 'item_contains',
      value: conditionBuilder.target.value
    };

    const ruleData = {
      brand_id: brandId,
      rule_type: 'conditional',
      name: conditionBuilder.name || generateRuleName(),
      condition_logic: {
        conditions: validConditions.map(c => ({ field: c.field, value: c.value })),
        operator: conditionBuilder.operator || 'AND',
        target: target,
      },
      is_enabled: true,
    };

    try {
      if (editingRule) {
        await fetch(`/api/blackout-rules/${editingRule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ruleData),
        });
        toast.success('Rule updated successfully');
      } else {
        await fetch('/api/blackout-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ruleData),
        });
        toast.success('Rule created successfully');
      }

      resetConditionBuilder();
      await loadRules();
    } catch (e) {
      console.error('Failed to save rule:', e);
      toast.error('Failed to save rule');
    }
  }

  async function saveCancelledItem() {
    if (!cancelledItem.sign_type || !cancelledItem.sign_version) {
      toast.error('Please fill in both Sign Type and Sign Version');
      return;
    }

    try {
      await fetch('/api/blackout-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: brandId,
          rule_type: 'cancelled',
          name: `Cancelled: ${cancelledItem.sign_type} - ${cancelledItem.sign_version}`,
          sign_type: cancelledItem.sign_type,
          sign_version: cancelledItem.sign_version,
          is_enabled: true,
        }),
      });

      cancelledItem = { sign_type: '', sign_version: '' };
      toast.success('Cancelled item added');
      await loadRules();
    } catch (e) {
      console.error('Failed to add cancelled item:', e);
      toast.error('Failed to add cancelled item');
    }
  }

  function generateRuleName() {
    const condText = conditionBuilder.conditions
      .map((c) => c.value)
      .join(` ${conditionBuilder.operator} `);
    return `If ${condText} → blackout ${conditionBuilder.target.value}`;
  }

  /** @param {{id: number, name: string, rule_type: string, is_enabled: boolean, sign_type?: string, sign_version?: string, condition_logic?: {conditions: Array<{field: string, value: string}>, operator: string, target: {field: string, value: string}}}} rule */
  function editRule(rule) {
    if (rule.rule_type === 'conditional' && rule.condition_logic) {
      const logic = rule.condition_logic;
      // Ensure conditions is always an array with valid objects
      const conditions = Array.isArray(logic.conditions) && logic.conditions.length > 0
        ? logic.conditions.map(c => ({
            field: c?.field || 'item_contains',
            value: c?.value || ''
          }))
        : [{ field: 'item_contains', value: '' }];
      
      // Ensure target is a valid object
      const target = logic.target && typeof logic.target === 'object'
        ? { field: logic.target.field || 'item_contains', value: logic.target.value || '' }
        : { field: 'item_contains', value: '' };
      
      conditionBuilder = {
        name: rule.name || '',
        conditions,
        operator: logic.operator || 'AND',
        target,
      };
      editingRule = rule;
      activeTab = 'conditional';
    }
  }

  /** @param {{id: number, name: string, rule_type: string, is_enabled: boolean, sign_type?: string, sign_version?: string, condition_logic?: {conditions: Array<{field: string, value: string}>, operator: string, target: {field: string, value: string}}}} rule */
  async function toggleRule(rule) {
    try {
      await fetch(`/api/blackout-rules/${rule.id}/toggle`, {
        method: 'PUT',
      });
      await loadRules();
      toast.success(`Rule ${rule.is_enabled ? 'disabled' : 'enabled'}`);
    } catch (e) {
      console.error('Failed to toggle rule:', e);
      toast.error('Failed to toggle rule');
    }
  }

  /** @param {{id: number, name: string, rule_type: string, is_enabled: boolean, sign_type?: string, sign_version?: string, condition_logic?: {conditions: Array<{field: string, value: string}>, operator: string, target: {field: string, value: string}}}} rule */
  async function deleteRule(rule) {
    const desc = rule.name || `${rule.sign_type} - ${rule.sign_version}`;
    if (!confirm(`Delete rule "${desc}"?`)) return;

    try {
      await fetch(`/api/blackout-rules/${rule.id}`, {
        method: 'DELETE',
      });
      await loadRules();
      toast.success('Rule deleted');
    } catch (e) {
      console.error('Failed to delete rule:', e);
      toast.error('Failed to delete rule');
    }
  }

  /** @param {{field: string, value: string}} condition */
  function _formatConditionDisplay(condition) {
    const fieldLabel =
      fieldOptions.find((f) => f.value === condition.field)?.label || condition.field;
    return `${fieldLabel}: "${condition.value}"`;
  }

  /** @param {Partial<{id: number, name: string, rule_type: string, is_enabled: boolean, sign_type?: string, sign_version?: string, condition_logic?: {conditions: Array<{field: string, value: string}>, operator: string, target: {field: string, value: string}}}>} rule */
  function formatRuleDescription(rule) {
    if (rule.rule_type === 'cancelled') {
      return `Always blackout: ${rule.sign_type || ''} → ${rule.sign_version || ''}`;
    }
    if (rule.condition_logic) {
      const conditions = Array.isArray(rule.condition_logic.conditions) ? rule.condition_logic.conditions : [];
      const target = rule.condition_logic.target || { field: '', value: '' };
      const operator = rule.condition_logic.operator || 'AND';

      const condText = conditions
        .filter((/** @type {{field: string, value: string}} */ c) => c && c.value)
        .map((/** @type {{field: string, value: string}} */ c) => `"${c.value}"`)
        .join(` ${operator} `);
      return `If order has ${condText} → blackout "${target.value || ''}"`;
    }
    return rule.name || 'Unknown rule';
  }

  $: conditionalRules = rules.filter((r) => r.rule_type === 'conditional');
  $: cancelledRules = rules.filter((r) => r.rule_type === 'cancelled' || !r.rule_type);
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Blackout Rules</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">
        Configure which items to redact from packing slips
      </p>
    </div>
  </div>

  <!-- Tab Navigation -->
  <div class="flex border-b border-gray-200 dark:border-gray-700">
    <button
      class="px-6 py-3 font-medium flex items-center gap-2 {activeTab === 'conditional'
        ? 'text-primary-600 border-b-2 border-primary-600'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
      on:click={() => {
        activeTab = 'conditional';
        resetConditionBuilder();
      }}
    >
      <Filter class="w-4 h-4" />
      Conditional Rules
    </button>
    <button
      class="px-6 py-3 font-medium flex items-center gap-2 {activeTab === 'cancelled'
        ? 'text-primary-600 border-b-2 border-primary-600'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
      on:click={() => (activeTab = 'cancelled')}
    >
      <Ban class="w-4 h-4" />
      Cancelled Items
    </button>
  </div>

  {#if activeTab === 'conditional'}
    <!-- Conditional Rule Builder (Mad-lib style) -->
    <Card>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {editingRule ? 'Edit Conditional Rule' : 'Create Conditional Rule'}
      </h2>
      <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">
        Build logic like: "If the order contains [Alcohol Kit] AND [Non-Alcohol Kit], blackout
        [Non-Alcohol Kit]"
      </p>

      <!-- Rule Name -->
      <div class="mb-4">
        <Input
          label="Rule Name (optional)"
          bind:value={conditionBuilder.name}
          placeholder="e.g., Blackout non-alc when alc present"
        />
      </div>

      <!-- Mad-lib Builder -->
      <div class="bg-gray-50 rounded-lg p-4 mb-4">
        <div class="text-lg mb-4">
          <span class="font-semibold text-gray-700">IF</span> the order contains:
        </div>

        <!-- Conditions -->
        <div class="space-y-3 ml-4 mb-4">
          {#each conditionBuilder.conditions as condition, index}
            <div class="flex items-center gap-2">
              {#if index > 0}
                <select
                  bind:value={conditionBuilder.operator}
                  class="w-20 px-2 py-2 bg-primary-100 text-primary-700 font-medium rounded border-0 text-center"
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              {:else}
                <div class="w-20"></div>
              {/if}

              <select
                bind:value={condition.field}
                class="flex-shrink-0 px-3 py-2 bg-white border border-gray-200 rounded"
              >
                {#each fieldOptions as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>

              <div class="flex-1 relative">
                <input
                  type="text"
                  bind:value={condition.value}
                  placeholder="e.g., Alcohol Version"
                  class="input-field w-full"
                  list="item-suggestions-{index}"
                />
                <datalist id="item-suggestions-{index}">
                  {#each getSuggestionsForField(condition.field) as suggestion}
                    <option value={suggestion} />
                  {/each}
                </datalist>
              </div>

              {#if conditionBuilder.conditions.length > 1}
                <button
                  class="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                  on:click={() => removeCondition(index)}
                  title="Remove condition"
                >
                  ✕
                </button>
              {/if}
            </div>
          {/each}

          <button
            class="text-primary-600 hover:text-primary-800 text-sm font-medium flex items-center gap-1"
            on:click={addCondition}
          >
            <span>+</span> Add another condition
          </button>
        </div>

        <!-- Target -->
        <div class="border-t border-gray-200 pt-4">
          <div class="text-lg mb-3">
            <span class="font-semibold text-gray-700">THEN</span> blackout items matching:
          </div>

          <div class="flex items-center gap-2 ml-4">
            <select
              bind:value={conditionBuilder.target.field}
              class="flex-shrink-0 px-3 py-2 bg-white border border-gray-200 rounded"
            >
              {#each fieldOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>

            <div class="flex-1 relative">
              <input
                type="text"
                bind:value={conditionBuilder.target.value}
                placeholder="e.g., Non-Alcohol Version"
                class="input-field w-full"
                list="target-suggestions"
              />
              <datalist id="target-suggestions">
                {#each getSuggestionsForField(conditionBuilder.target.field) as suggestion}
                  <option value={suggestion} />
                {/each}
              </datalist>
            </div>
          </div>
        </div>
      </div>

      <!-- Preview -->
      {#if conditionBuilder.conditions.some((c) => c.value) && conditionBuilder.target.value}
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <span class="text-sm text-blue-700 font-medium">Preview:</span>
          <span class="text-sm text-blue-800 ml-2">
            {formatRuleDescription({
              rule_type: 'conditional',
              condition_logic: {
                conditions: conditionBuilder.conditions,
                operator: conditionBuilder.operator,
                target: conditionBuilder.target,
              },
            })}
          </span>
        </div>
      {/if}

      <!-- Actions -->
      <div class="flex gap-2">
        <Button on:click={saveConditionalRule}>
          <Save class="w-4 h-4 mr-2" />
          {editingRule ? 'Update Rule' : 'Save Rule'}
        </Button>
        {#if editingRule}
          <Button variant="secondary" on:click={resetConditionBuilder}>
            <X class="w-4 h-4 mr-2" />
            Cancel Edit
          </Button>
        {/if}
      </div>
    </Card>

    <!-- Conditional Rules List -->
    <Card>
      <div class="pb-4 border-b dark:border-gray-700 -mx-6 px-6 -mt-6 pt-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          Conditional Rules ({conditionalRules.length})
        </h2>
        <p class="text-gray-500 dark:text-gray-400 text-sm">
          Rules that blackout items based on what else is in the order
        </p>
      </div>

      {#if loading}
        <div class="p-8 text-center">
          <Loader2 class="w-8 h-8 animate-spin text-primary-600 mx-auto" />
        </div>
      {:else if conditionalRules.length === 0}
        <div class="p-8 text-center text-gray-500 dark:text-gray-400">
          <Filter class="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No conditional rules yet</p>
          <p class="text-sm mt-1">Create rules above to blackout items based on order contents</p>
        </div>
      {:else}
        <div class="divide-y dark:divide-gray-700">
          {#each conditionalRules as rule}
            <div
              class="py-4 first:pt-0 last:pb-0 hover:bg-gray-50 dark:hover:bg-gray-800 {rule.is_enabled
                ? ''
                : 'opacity-50'} -mx-6 px-6"
            >
              <div class="flex items-start justify-between">
                <div class="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={rule.is_enabled}
                    on:change={() => toggleRule(rule)}
                    class="mt-1 w-4 h-4 rounded border-gray-300 text-primary-600"
                  />
                  <div>
                    <div class="font-medium text-gray-900 dark:text-white">
                      {rule.name || 'Unnamed Rule'}
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {formatRuleDescription(rule)}
                    </div>
                  </div>
                </div>
                <div class="flex gap-2">
                  <Button variant="ghost" size="sm" on:click={() => editRule(rule)}>
                    <Pencil class="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" on:click={() => deleteRule(rule)}>
                    <Trash2 class="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </Card>
  {:else}
    <!-- Cancelled Items Tab -->
    <Card>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Add Cancelled Item</h2>
      <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">
        Items added here will be blacked out on <strong>every</strong> packing slip, regardless of other
        items. Use this for items that have been cancelled or should never appear.
      </p>

      <div class="grid grid-cols-12 gap-4">
        <div class="col-span-4">
          <label class="label" for="cancelled-sign-type">Sign Type</label>
          <input
            id="cancelled-sign-type"
            type="text"
            bind:value={cancelledItem.sign_type}
            placeholder="e.g., Shelf Wobbler"
            class="input-field"
          />
        </div>
        <div class="col-span-6">
          <label class="label" for="cancelled-sign-version">Sign Version / Promotion</label>
          <input
            id="cancelled-sign-version"
            type="text"
            bind:value={cancelledItem.sign_version}
            placeholder="e.g., Spring Promo 2024"
            class="input-field"
          />
        </div>
        <div class="col-span-2 flex items-end">
          <Button fullWidth on:click={saveCancelledItem}>
            <Plus class="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      </div>
    </Card>

    <!-- Cancelled Items List -->
    <Card>
      <div class="pb-4 border-b dark:border-gray-700 -mx-6 px-6 -mt-6 pt-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          Cancelled Items ({cancelledRules.length})
        </h2>
        <p class="text-gray-500 dark:text-gray-400 text-sm">Items that are always blacked out</p>
      </div>

      {#if loading}
        <div class="p-8 text-center">
          <Loader2 class="w-8 h-8 animate-spin text-primary-600 mx-auto" />
        </div>
      {:else if cancelledRules.length === 0}
        <div class="p-8 text-center text-gray-500 dark:text-gray-400">
          <Ban class="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No cancelled items</p>
          <p class="text-sm mt-1">Add items above that should always be blacked out</p>
        </div>
      {:else}
        <table class="w-full">
          <thead class="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400"
                >Enabled</th
              >
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400"
                >Sign Type</th
              >
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400"
                >Sign Version</th
              >
              <th class="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-400"
                >Actions</th
              >
            </tr>
          </thead>
          <tbody class="divide-y dark:divide-gray-700">
            {#each cancelledRules as rule}
              <tr
                class="hover:bg-gray-50 dark:hover:bg-gray-800 {rule.is_enabled
                  ? ''
                  : 'opacity-50'}"
              >
                <td class="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={rule.is_enabled}
                    on:change={() => toggleRule(rule)}
                    class="w-4 h-4 rounded border-gray-300 text-primary-600"
                  />
                </td>
                <td class="px-4 py-3 font-medium text-gray-900 dark:text-white"
                  >{rule.sign_type || '-'}</td
                >
                <td class="px-4 py-3 text-gray-600 dark:text-gray-400"
                  >{rule.sign_version || '-'}</td
                >
                <td class="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" on:click={() => deleteRule(rule)}>
                    <Trash2 class="w-4 h-4 text-red-500" />
                  </Button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </Card>
  {/if}
</div>
