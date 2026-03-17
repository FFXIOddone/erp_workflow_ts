<script>
  import { createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition';
  import {
    FileText,
    ArrowUpDown,
    EyeOff,
    Download,
    LayoutDashboard,
    Puzzle,
    History,
    Building2,
    Palette,
    Package,
    ChevronDown,
    SlidersHorizontal,
  } from 'lucide-svelte';
  import ThemeToggle from './components/ThemeToggle.svelte';

  export let currentView = 'process';

  const dispatch = createEventDispatcher();

  /**
   * @typedef {{id: string, label: string, icon: any, children?: {id: string, label: string, icon: any}[]}} NavItem
   */

  /** @type {NavItem[]} */
  const navItems = [
    { id: 'process', label: 'Process', icon: FileText },
    {
      id: 'rules',
      label: 'Rules',
      icon: SlidersHorizontal,
      children: [
        { id: 'sorting', label: 'Sort Config', icon: ArrowUpDown },
        { id: 'blackout', label: 'Blackout Rules', icon: EyeOff },
        { id: 'formatting', label: 'Formatting', icon: Palette },
      ],
    },
    {
      id: 'output',
      label: 'Output',
      icon: Download,
      children: [
        { id: 'generate', label: 'Generate PDF', icon: Download },
        { id: 'wobblers', label: 'Wobbler Kits', icon: Package },
      ],
    },
    { id: 'patterns', label: 'Patterns', icon: Puzzle },
    { id: 'brands', label: 'Brands', icon: Building2 },
    { id: 'history', label: 'History', icon: History },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ];

  /** Track which groups are expanded */
  /** @type {Set<string>} */
  let expandedGroups = new Set();

  // Auto-expand the group containing the current view
  $: {
    for (const item of navItems) {
      if (item.children) {
        const childIds = item.children.map((c) => c.id);
        if (childIds.includes(currentView)) {
          expandedGroups.add(item.id);
          expandedGroups = expandedGroups;
        }
      }
    }
  }

  /** @param {string} groupId */
  function toggleGroup(groupId) {
    if (expandedGroups.has(groupId)) {
      expandedGroups.delete(groupId);
    } else {
      expandedGroups.add(groupId);
    }
    expandedGroups = expandedGroups;
  }

  /** @param {string} viewId */
  function navigate(viewId) {
    dispatch('navigate', viewId);
  }

  /**
   * Check if a nav item or any of its children is active
   * @param {NavItem} item
   * @param {string} view
   * @returns {boolean}
   */
  function isGroupActive(item, view) {
    if (item.children) {
      return item.children.some((c) => c.id === view);
    }
    return item.id === view;
  }
</script>

<aside class="w-52 bg-gray-900 dark:bg-gray-950 text-white flex flex-col shrink-0">
  <!-- Header -->
  <div class="px-4 py-4 border-b border-gray-800">
    <h1 class="text-base font-semibold flex items-center gap-2">
      <span
        class="w-7 h-7 bg-primary-600 rounded-md flex items-center justify-center text-xs font-bold"
      >PS</span>
      <span class="text-gray-100">Slip Sort</span>
    </h1>
  </div>

  <!-- Navigation -->
  <nav class="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
    {#each navItems as item}
      {#if item.children}
        <!-- Group header -->
        <button
          class="w-full text-left px-3 py-2 rounded-md flex items-center gap-2.5 text-sm transition-colors
                 {isGroupActive(item, currentView)
            ? 'text-white bg-gray-800'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}"
          on:click={() => toggleGroup(item.id)}
        >
          <svelte:component this={item.icon} size={16} strokeWidth={1.5} />
          <span class="font-medium flex-1">{item.label}</span>
          <ChevronDown
            size={14}
            class="transition-transform duration-200 {expandedGroups.has(item.id) ? 'rotate-180' : ''}"
          />
        </button>

        <!-- Sub-items -->
        {#if expandedGroups.has(item.id)}
          <div transition:slide={{ duration: 150 }} class="ml-3 pl-3 border-l border-gray-800 space-y-0.5 py-0.5">
            {#each item.children as child}
              <button
                class="w-full text-left px-3 py-1.5 rounded-md flex items-center gap-2 text-sm transition-colors
                       {currentView === child.id
                  ? 'text-white bg-primary-600'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}"
                on:click={() => navigate(child.id)}
                aria-current={currentView === child.id ? 'page' : undefined}
              >
                <svelte:component this={child.icon} size={14} strokeWidth={1.5} />
                <span>{child.label}</span>
              </button>
            {/each}
          </div>
        {/if}
      {:else}
        <!-- Direct navigation item -->
        <button
          class="w-full text-left px-3 py-2 rounded-md flex items-center gap-2.5 text-sm transition-colors
                 {currentView === item.id
            ? 'text-white bg-primary-600'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}"
          on:click={() => navigate(item.id)}
          aria-current={currentView === item.id ? 'page' : undefined}
        >
          <svelte:component this={item.icon} size={16} strokeWidth={1.5} />
          <span class="font-medium">{item.label}</span>
        </button>
      {/if}
    {/each}
  </nav>

  <!-- Footer -->
  <div class="px-3 py-3 border-t border-gray-800 flex items-center justify-between">
    <p class="text-xs text-gray-500">v2.0</p>
    <ThemeToggle />
  </div>
</aside>
