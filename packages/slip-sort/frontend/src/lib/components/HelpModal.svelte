<script>
  import { Modal } from './ui';
  import { HelpCircle, ChevronRight, FileText, Settings, Palette, Ban, Download, History, Tag, Layers } from 'lucide-svelte';

  export let isOpen = false;
  /** @type {string} */
  export let currentView = 'process';

  function close() {
    isOpen = false;
  }

  /** @type {Record<string, {title: string, icon: any, steps: string[], tips?: string[]}>} */
  const helpContent = {
    dashboard: {
      title: 'Dashboard',
      icon: Layers,
      steps: [
        'View an overview of your recent processing activity',
        'See statistics on batches processed, orders sorted, and items blacked out',
        'Quick access cards let you jump to common actions',
        'Recent batches show your latest PDF processing results'
      ],
      tips: [
        'Use the dashboard as your starting point each session',
        'Check for any failed batches that need attention'
      ]
    },
    process: {
      title: 'Process PDF',
      icon: FileText,
      steps: [
        'Click "Select PDF File" or drag and drop a packing slip PDF',
        'The system will automatically extract store orders from the PDF',
        'Review the extracted data in the preview table',
        'Click "Process & Sort" to apply sorting and blackout rules',
        'Once processing completes, proceed to Generate Output'
      ],
      tips: [
        'Ensure PDFs are in the expected format with clear text',
        'Large PDFs may take a few moments to process',
        'You can process multiple batches before generating output'
      ]
    },
    patterns: {
      title: 'Pattern Builder',
      icon: Settings,
      steps: [
        'Upload a sample PDF page to define extraction regions',
        'Click and drag on the PDF preview to draw rectangles around data fields',
        'Name each region (e.g., "store_code", "sign_type", "quantity")',
        'Use the field suggestions for common field names',
        'Save your pattern configuration for future use',
        'Test the pattern on sample pages to verify extraction'
      ],
      tips: [
        'Start with the most important fields like store_code and sign_type',
        'Draw regions slightly larger than the text to ensure capture',
        'Use consistent field names across all your patterns'
      ]
    },
    sorting: {
      title: 'Sort Configuration',
      icon: Layers,
      steps: [
        'View the current sort bucket visualization at the top',
        'Each tier represents a level of sorting (Box Category → Kit Type → etc.)',
        'Enable/disable tiers using the toggle switch',
        'Drag tiers to reorder priority (Tier 1 sorts first)',
        'Add categories within each tier using the + button',
        'Reorder categories with the ▲▼ buttons',
        'Click "Save Configuration" to apply changes'
      ],
      tips: [
        'The example bucket path shows how orders will be grouped',
        'Disabled tiers are skipped during sorting',
        'Box/Envelope Category tier controls physical packaging grouping',
        'Store Code tier typically uses alphabetical sorting'
      ]
    },
    blackout: {
      title: 'Blackout Configuration',
      icon: Ban,
      steps: [
        'Choose between "Conditional Rules" or "Cancelled Items" tabs',
        'For conditional rules: Set conditions that trigger blackouts',
        'Add multiple conditions with AND/OR logic',
        'Specify the target item to black out when conditions are met',
        'For cancelled items: Enter sign type and version to always black out',
        'Enable/disable rules with the toggle switch',
        'Click "Save" to apply each rule'
      ],
      tips: [
        'Use wildcards (*) to match partial item names',
        'Test rules on a small batch before processing large files',
        'Cancelled items are useful for discontinued products'
      ]
    },
    generate: {
      title: 'Generate Output',
      icon: Download,
      steps: [
        'Select the batch(es) you want to generate output for',
        'Choose output format options if available',
        'Click "Generate PDF" to create the sorted output',
        'Review the generation preview',
        'Download the generated PDF file',
        'Optionally generate store labels or summary reports'
      ],
      tips: [
        'Generated PDFs maintain original quality',
        'File names include batch date for easy organization',
        'Check the output folder for your generated files'
      ]
    },
    history: {
      title: 'Order History',
      icon: History,
      steps: [
        'Browse previously processed batches in the list',
        'Use filters to search by date, store, or status',
        'Click on a batch to view detailed order information',
        'Export historical data for reporting',
        'Reprocess batches if rules have changed'
      ],
      tips: [
        'Use date range filters for quarterly reports',
        'Click column headers to sort the list',
        'Order details show all extracted fields and applied rules'
      ]
    },
    brands: {
      title: 'Brand Manager',
      icon: Tag,
      steps: [
        'View all configured brands in the card grid',
        'Click "Add Brand" to create a new brand configuration',
        'Enter brand name, code, and optional description',
        'Click on a brand card to edit its settings',
        'Each brand can have unique patterns and rules',
        'Delete brands you no longer need'
      ],
      tips: [
        'Brand codes are used in output file names',
        'Configure patterns separately for each brand',
        'The default brand is used when processing unmarked PDFs'
      ]
    },
    formatting: {
      title: 'Selective Formatting',
      icon: Palette,
      steps: [
        'Create rules to apply special formatting to specific items',
        'Choose target type: element, field, or text match',
        'Set the style properties: colors, font, borders',
        'Preview your formatting in the live preview box',
        'Enable/disable formatting rules as needed',
        'Rules are applied during PDF generation'
      ],
      tips: [
        'Use bold or colors to highlight important items',
        'Border formatting helps group related items visually',
        'Test formatting on a sample before full processing'
      ]
    }
  };

  $: content = helpContent[currentView] || helpContent.process;
</script>

<Modal bind:open={isOpen} title="Help: {content.title}" size="lg" on:close={close}>
  <div class="space-y-6">
    <!-- Header with icon -->
    <div class="flex items-center gap-4 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
      <div class="p-3 bg-primary-100 dark:bg-primary-800 rounded-full">
        <svelte:component this={content.icon} class="w-8 h-8 text-primary-600 dark:text-primary-400" />
      </div>
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{content.title}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">Step-by-step instructions</p>
      </div>
    </div>

    <!-- Steps -->
    <div class="space-y-3">
      <h4 class="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <ChevronRight class="w-4 h-4" />
        How to use this screen
      </h4>
      <ol class="space-y-2 ml-4">
        {#each content.steps as step, i}
          <li class="flex items-start gap-3">
            <span class="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-primary-100 dark:bg-primary-800 text-primary-700 dark:text-primary-300 text-sm font-medium">
              {i + 1}
            </span>
            <span class="text-gray-600 dark:text-gray-300 pt-0.5">{step}</span>
          </li>
        {/each}
      </ol>
    </div>

    <!-- Tips -->
    {#if content.tips && content.tips.length > 0}
      <div class="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 class="font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
          💡 Tips
        </h4>
        <ul class="space-y-2 ml-4">
          {#each content.tips as tip}
            <li class="flex items-start gap-2 text-gray-600 dark:text-gray-300">
              <span class="text-amber-500">•</span>
              <span>{tip}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <!-- Quick Navigation -->
    <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
      <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-3">Quick Navigation</h4>
      <div class="grid grid-cols-3 gap-2">
        {#each Object.entries(helpContent) as [key, section]}
          <button
            class="flex items-center gap-2 p-2 text-sm rounded-lg transition-colors
              {key === currentView 
                ? 'bg-primary-100 dark:bg-primary-800 text-primary-700 dark:text-primary-300' 
                : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}"
            on:click={() => { currentView = key; }}
          >
            <svelte:component this={section.icon} class="w-4 h-4" />
            <span class="truncate">{section.title}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <div slot="footer" class="flex justify-between items-center">
    <p class="text-xs text-gray-400 dark:text-gray-500">
      Press <kbd class="px-1.5 py-0.5 mx-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 rounded">?</kbd> or click the help button anytime
    </p>
    <button
      class="text-sm text-primary-600 dark:text-primary-400 hover:underline"
      on:click={close}
    >
      Got it!
    </button>
  </div>
</Modal>
