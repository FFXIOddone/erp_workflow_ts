<script>
  /**
   * @typedef {Object} TableColumn
   * @property {string} key - Column key
   * @property {string} label - Column label
   * @property {boolean} [sortable] - Whether column is sortable
   * @property {string} [width] - Column width
   * @property {((value: any, row: any, index: number) => string)} [render] - Custom render function returning HTML
   * @property {((value: any, row: any, index: number) => string)} [format] - Custom format function
   */
  
  /** @type {TableColumn[]} */
  export let columns = [];
  /** @type {any[]} */
  export let data = [];
  export let loading = false;
  export let emptyMessage = 'No data available';
  export let sortKey = '';
  export let sortDirection = 'asc';
  export let selectable = false;
  /** @type {any[]} */
  export let selectedRows = [];

  import { createEventDispatcher } from 'svelte';
  import { ArrowUp, ArrowDown, Loader2 } from 'lucide-svelte';

  const dispatch = createEventDispatcher();

  /**
   * Basic HTML sanitizer to prevent XSS in render() output.
   * Strips <script>, on* attributes, and javascript: URLs.
   * @param {string} html
   * @returns {string}
   */
  function sanitizeHtml(html) {
    if (!html || typeof html !== 'string') return html || '';
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript\s*:/gi, '');
  }

  /** @param {TableColumn} column */
  function handleSort(column) {
    if (!column.sortable) return;

    if (sortKey === column.key) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = column.key;
      sortDirection = 'asc';
    }

    dispatch('sort', { key: sortKey, direction: sortDirection });
  }

  /** @param {any} row @param {number} index */
  function handleRowClick(row, index) {
    dispatch('rowClick', { row, index });
  }

  /** @param {any} row */
  function toggleRow(row) {
    const idx = selectedRows.findIndex((r) => r === row);
    if (idx >= 0) {
      selectedRows = selectedRows.filter((r) => r !== row);
    } else {
      selectedRows = [...selectedRows, row];
    }
    dispatch('selectionChange', { selectedRows });
  }

  function toggleAll() {
    if (selectedRows.length === data.length) {
      selectedRows = [];
    } else {
      selectedRows = [...data];
    }
    dispatch('selectionChange', { selectedRows });
  }
</script>

<div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
  <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
    <thead class="bg-gray-50 dark:bg-gray-800">
      <tr>
        {#if selectable}
          <th scope="col" class="w-12 px-4 py-3">
            <input
              type="checkbox"
              class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={selectedRows.length === data.length && data.length > 0}
              indeterminate={selectedRows.length > 0 && selectedRows.length < data.length}
              on:change={toggleAll}
              aria-label="Select all rows"
            />
          </th>
        {/if}

        {#each columns as column}
          <th
            scope="col"
            class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            style={column.width ? `width: ${column.width}` : ''}
            class:cursor-pointer={column.sortable}
            on:click={() => handleSort(column)}
            aria-sort={sortKey === column.key
              ? sortDirection === 'asc'
                ? 'ascending'
                : 'descending'
              : 'none'}
          >
            <div class="flex items-center gap-2">
              {column.label}
              {#if column.sortable}
                <span class="text-gray-400">
                  {#if sortKey === column.key}
                    {#if sortDirection === 'asc'}
                      <ArrowUp size={14} />
                    {:else}
                      <ArrowDown size={14} />
                    {/if}
                  {:else}
                    <ArrowUp size={14} class="opacity-30" />
                  {/if}
                </span>
              {/if}
            </div>
          </th>
        {/each}
      </tr>
    </thead>

    <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
      {#if loading}
        <tr>
          <td colspan={columns.length + (selectable ? 1 : 0)} class="px-4 py-12 text-center">
            <div class="flex items-center justify-center gap-2 text-gray-500">
              <Loader2 size={20} class="animate-spin" />
              <span>Loading...</span>
            </div>
          </td>
        </tr>
      {:else if data.length === 0}
        <tr>
          <td
            colspan={columns.length + (selectable ? 1 : 0)}
            class="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
          >
            {emptyMessage}
          </td>
        </tr>
      {:else}
        {#each data as row, index}
          <tr
            class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            class:cursor-pointer={$$restProps.onrowClick}
            on:click={() => handleRowClick(row, index)}
          >
            {#if selectable}
              <td class="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={selectedRows.includes(row)}
                  on:change={() => toggleRow(row)}
                  on:click|stopPropagation
                  aria-label="Select row"
                />
              </td>
            {/if}

            {#each columns as column}
              <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                {#if column.render}
                  {@html sanitizeHtml(column.render(row[column.key], row, index))}
                {:else if column.format}
                  {column.format(row[column.key], row, index)}
                {:else}
                  {row[column.key] ?? '-'}
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>
