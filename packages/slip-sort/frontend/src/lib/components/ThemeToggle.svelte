<script>
  import { onMount } from 'svelte';
  import { Sun, Moon, Monitor } from 'lucide-svelte';
  import { writable } from 'svelte/store';

  // Theme store: 'light', 'dark', or 'system'
  export const theme = writable('system');

  let currentTheme = 'system';
  let mounted = false;

  // Subscribe to theme changes
  theme.subscribe((value) => {
    currentTheme = value;
    if (mounted) {
      applyTheme(/** @type {'light' | 'dark' | 'system'} */ (value));
    }
  });

  /** @param {'light' | 'dark' | 'system'} value */
  function applyTheme(value) {
    if (typeof window === 'undefined') return;

    localStorage.setItem('theme', value);

    if (
      value === 'dark' ||
      (value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  function cycleTheme() {
    const themes = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    theme.set(themes[nextIndex]);
  }

  onMount(() => {
    mounted = true;

    // Load saved theme
    const saved = localStorage.getItem('theme') || 'system';
    theme.set(saved);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (currentTheme === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  });

  $: icon = currentTheme === 'light' ? Sun : currentTheme === 'dark' ? Moon : Monitor;
  $: label =
    currentTheme === 'light'
      ? 'Light mode'
      : currentTheme === 'dark'
        ? 'Dark mode'
        : 'System theme';
</script>

<button
  type="button"
  class="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
  on:click={cycleTheme}
  aria-label={label}
  title={label}
>
  <svelte:component this={icon} size={20} />
</button>
