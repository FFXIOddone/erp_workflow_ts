<script>
  /** @type {'primary'|'secondary'|'danger'|'ghost'|'outline'} */
  export let variant = 'primary';
  /** @type {'sm'|'md'|'lg'} */
  export let size = 'md';
  export let disabled = false;
  export let loading = false;
  /** @type {'button'|'submit'|'reset'} */
  export let type = 'button';
  export let fullWidth = false;

  /** @type {Record<'primary'|'secondary'|'danger'|'ghost'|'outline', string>} */
  const variants = {
    primary: 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm focus:ring-primary-500',
    secondary:
      'bg-gray-100 hover:bg-gray-200 text-gray-700 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm focus:ring-red-500',
    ghost:
      'bg-transparent hover:bg-gray-100 text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800',
    outline:
      'border-2 border-primary-600 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20',
  };

  /** @type {Record<'sm'|'md'|'lg', string>} */
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  $: classes = [
    'inline-flex items-center justify-center gap-2 font-medium rounded-lg',
    'transition-all duration-200 ease-in-out',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    variants[variant],
    sizes[size],
    fullWidth ? 'w-full' : '',
  ].join(' ');
</script>

<button
  {type}
  class={classes}
  disabled={disabled || loading}
  on:click
  on:focus
  on:blur
  aria-busy={loading}
  {...$$restProps}
>
  {#if loading}
    <svg
      class="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
      ></circle>
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  {/if}
  <slot />
</button>
