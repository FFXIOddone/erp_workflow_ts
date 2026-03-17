<script>
  /** @type {'none' | 'sm' | 'md' | 'lg'} */
  export let padding = 'md';
  export let hover = false;
  export let clickable = false;

  /** @type {Record<'none' | 'sm' | 'md' | 'lg', string>} */
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  $: classes = [
    'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700',
    paddings[padding],
    hover ? 'transition-shadow hover:shadow-md' : '',
    clickable ? 'cursor-pointer' : '',
  ].join(' ');
</script>

<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<div
  class={classes}
  role={clickable ? 'button' : undefined}
  tabindex={clickable ? 0 : -1}
  on:click
  on:keydown
  {...$$restProps}
>
  <slot />
</div>
