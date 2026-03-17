<script>
  export let type = 'text';
  export let value = '';
  export let placeholder = '';
  export let label = '';
  export let error = '';
  export let hint = '';
  export let disabled = false;
  export let required = false;
  export let id = `input-${Math.random().toString(36).slice(2)}`;
  /** @type {'sm'|'md'|'lg'} */
  export let size = 'md';

  /** @type {Record<'sm'|'md'|'lg', string>} */
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  $: inputClasses = [
    'block w-full rounded-lg border transition-colors duration-200',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
    'dark:bg-gray-800 dark:text-white',
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

  {#if type === 'textarea'}
    <textarea
      {id}
      bind:value
      {placeholder}
      {disabled}
      {required}
      class={inputClasses}
      class:resize-none={$$restProps.resize === false}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      on:input
      on:focus
      on:blur
      on:change
      {...$$restProps}
    />
  {:else if type === 'search'}
    <div class="relative">
      <input
        {id}
        type="search"
        bind:value
        {placeholder}
        {disabled}
        {required}
        class="{inputClasses} pl-10"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        on:input
        on:focus
        on:blur
        on:change
        {...$$restProps}
      />
      <svg
        class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </div>
  {:else if type === 'password'}
    <input
      {id}
      type="password"
      bind:value
      {placeholder}
      {disabled}
      {required}
      class={inputClasses}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      on:input
      on:focus
      on:blur
      on:change
      {...$$restProps}
    />
  {:else if type === 'email'}
    <input
      {id}
      type="email"
      bind:value
      {placeholder}
      {disabled}
      {required}
      class={inputClasses}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      on:input
      on:focus
      on:blur
      on:change
      {...$$restProps}
    />
  {:else if type === 'number'}
    <input
      {id}
      type="number"
      bind:value
      {placeholder}
      {disabled}
      {required}
      class={inputClasses}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      on:input
      on:focus
      on:blur
      on:change
      {...$$restProps}
    />
  {:else}
    <input
      {id}
      type="text"
      bind:value
      {placeholder}
      {disabled}
      {required}
      class={inputClasses}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      on:input
      on:focus
      on:blur
      on:change
      {...$$restProps}
    />
  {/if}

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
