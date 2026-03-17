<script>
  /**
   * @typedef {Object} SelectOption
   * @property {string} value - Option value
   * @property {string} label - Option label
   * @property {boolean} [disabled] - Whether option is disabled
   */
  
  export let value = '';
  /** @type {SelectOption[]} */
  export let options = [];
  export let label = '';
  export let error = '';
  export let hint = '';
  export let placeholder = 'Select an option';
  export let disabled = false;
  export let required = false;
  export let id = `select-${Math.random().toString(36).slice(2)}`;
  /** @type {'sm' | 'md' | 'lg'} */
  export let size = 'md';

  /** @type {Record<'sm' | 'md' | 'lg', string>} */
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  $: selectClasses = [
    'block w-full rounded-lg border transition-colors duration-200 appearance-none',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
    'dark:bg-gray-800 dark:text-white',
    'bg-no-repeat bg-right',
    sizes[size],
    error
      ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
      : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500/20',
    disabled ? 'bg-gray-100 dark:bg-gray-900 cursor-not-allowed opacity-60' : 'bg-white',
  ].join(' ');
</script>

<div class="space-y-1.5">
  {#if label}
    <label for={id} class="block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
      {#if required}
        <span class="text-red-500 ml-0.5">*</span>
      {/if}
    </label>
  {/if}

  <div class="relative">
    <select
      {id}
      bind:value
      {disabled}
      {required}
      class={selectClasses}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      on:change
      on:focus
      on:blur
      {...$$restProps}
    >
      {#if placeholder}
        <option value="" disabled>{placeholder}</option>
      {/if}

      {#each options as option}
        <option value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      {/each}
    </select>

    <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
      <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>

  {#if error}
    <p id="{id}-error" class="text-sm text-red-600 dark:text-red-400" role="alert">
      {error}
    </p>
  {:else if hint}
    <p id="{id}-hint" class="text-sm text-gray-500 dark:text-gray-400">
      {hint}
    </p>
  {/if}
</div>
