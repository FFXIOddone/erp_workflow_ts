<script>
  /** @type {'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary' | 'destructive'} */
  export let variant = 'default';
  /** @type {'sm' | 'md' | 'lg'} */
  export let size = 'md';
  export let dot = false;

  /** @type {Record<string, string>} */
  const variants = {
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    primary: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
    secondary: 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300',
    destructive: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  /** @type {Record<'sm' | 'md' | 'lg', string>} */
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1 text-sm',
  };

  /** @type {Record<string, string>} */
  const dotColors = {
    default: 'bg-gray-400',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500',
    primary: 'bg-primary-500',
    secondary: 'bg-gray-400',
    destructive: 'bg-red-500',
  };

  $: classes = [
    'inline-flex items-center gap-1.5 font-medium rounded-full',
    variants[variant],
    sizes[size],
  ].join(' ');
</script>

<span class={classes} {...$$restProps}>
  {#if dot}
    <span class="w-1.5 h-1.5 rounded-full {dotColors[variant]}"></span>
  {/if}
  <slot />
</span>
