<script>
  /**
   * Skeleton loading component for placeholder UI while content loads
   */
  export let variant = 'text';
  export let count = 1;
</script>

{#if variant === 'text'}
  <div class="space-y-2">
    {#each Array(count) as _}
      <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-md h-4 w-full" />
    {/each}
  </div>

{:else if variant === 'card'}
  {#each Array(count) as _}
    <div class="animate-pulse bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
      <div class="flex items-center gap-4 mb-4">
        <div class="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div class="flex-1 space-y-2">
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
        </div>
      </div>
      <div class="space-y-3">
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded" />
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
      </div>
    </div>
  {/each}

{:else if variant === 'avatar'}
  {#each Array(count) as _}
    <div class="animate-pulse flex items-center gap-3">
      <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
      <div class="space-y-2 flex-1">
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
        <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded w-16" />
      </div>
    </div>
  {/each}

{:else if variant === 'button'}
  <div class="animate-pulse h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-24" />

{:else if variant === 'table-row'}
  {#each Array(count) as _}
    <tr class="animate-pulse">
      <td class="py-3 px-4"><div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" /></td>
      <td class="py-3 px-4"><div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" /></td>
      <td class="py-3 px-4"><div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" /></td>
      <td class="py-3 px-4"><div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" /></td>
      <td class="py-3 px-4"><div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" /></td>
    </tr>
  {/each}

{:else if variant === 'stats'}
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    {#each Array(3) as _}
      <div class="animate-pulse bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div class="space-y-2 flex-1">
            <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
            <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-12" />
          </div>
        </div>
      </div>
    {/each}
  </div>

{:else if variant === 'list'}
  <div class="space-y-4">
    {#each Array(count) as _}
      <div class="animate-pulse bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <div class="space-y-2 flex-1">
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-28" />
            <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-40" />
          </div>
          <div class="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    {/each}
  </div>
{/if}
