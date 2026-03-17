<script>
  export let checked = false;
  export let disabled = false;
  export let label = '';
  export let description = '';
  /** @type {'sm' | 'md' | 'lg'} */
  export let size = 'md';
  export let id = `toggle-${Math.random().toString(36).slice(2)}`;

  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  /** @type {Record<'sm' | 'md' | 'lg', {track: string, thumb: string, translate: string}>} */
  const sizes = {
    sm: { track: 'w-8 h-4', thumb: 'w-3 h-3', translate: 'translate-x-4' },
    md: { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 'translate-x-5' },
    lg: { track: 'w-14 h-7', thumb: 'w-6 h-6', translate: 'translate-x-7' },
  };

  function toggle() {
    if (disabled) return;
    checked = !checked;
    dispatch('change', { checked });
  }
</script>

<div class="flex items-start gap-3">
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-labelledby={label ? `${id}-label` : undefined}
    aria-describedby={description ? `${id}-desc` : undefined}
    {disabled}
    class="relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {sizes[
      size
    ].track} {checked ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'}"
    on:click={toggle}
  >
    <span
      class="pointer-events-none inline-block transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {sizes[
        size
      ].thumb} {checked ? sizes[size].translate : 'translate-x-0.5'}"
      style="margin-top: 0.125rem;"
    />
  </button>

  {#if label || description}
    <div class="flex flex-col">
      {#if label}
        <span id="{id}-label" class="text-sm font-medium text-gray-900 dark:text-white">
          {label}
        </span>
      {/if}
      {#if description}
        <span id="{id}-desc" class="text-sm text-gray-500 dark:text-gray-400">
          {description}
        </span>
      {/if}
    </div>
  {/if}
</div>
