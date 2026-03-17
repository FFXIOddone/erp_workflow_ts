<script>
  import { Modal, Button } from './ui';
  import { AlertTriangle, Trash2, Info, CheckCircle } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  /** @type {boolean} */
  export let open = false;

  /** @type {'danger' | 'warning' | 'info' | 'success'} */
  export let variant = 'danger';

  /** @type {string} */
  export let title = 'Confirm Action';

  /** @type {string} */
  export let message = 'Are you sure you want to proceed?';

  /** @type {string} */
  export let confirmText = 'Confirm';

  /** @type {string} */
  export let cancelText = 'Cancel';

  /** @type {boolean} */
  export let loading = false;

  /**
   * @typedef {Object} VariantConfig
   * @property {typeof Trash2} icon
   * @property {string} iconBg
   * @property {string} iconColor
   * @property {'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'} buttonVariant
   */
  
  /** @type {Record<'danger' | 'warning' | 'info' | 'success', VariantConfig>} */
  const variants = {
    danger: {
      icon: Trash2,
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      buttonVariant: 'danger'
    },
    warning: {
      icon: AlertTriangle,
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      buttonVariant: 'primary'
    },
    info: {
      icon: Info,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      buttonVariant: 'primary'
    },
    success: {
      icon: CheckCircle,
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
      buttonVariant: 'primary'
    }
  };

  $: config = variants[variant];

  function handleConfirm() {
    dispatch('confirm');
  }

  function handleCancel() {
    dispatch('cancel');
    open = false;
  }
</script>

<Modal bind:open {title} size="sm" on:close={handleCancel}>
  <div class="flex flex-col items-center text-center py-4">
    <div class="p-4 rounded-full {config.iconBg} mb-4">
      <svelte:component this={config.icon} size={32} class={config.iconColor} />
    </div>
    
    <p class="text-gray-600 dark:text-gray-300 max-w-sm">
      {message}
    </p>
  </div>

  <svelte:fragment slot="footer">
    <div class="flex gap-3 w-full justify-end">
      <Button variant="secondary" on:click={handleCancel} disabled={loading}>
        {cancelText}
      </Button>
      <Button 
        variant={config.buttonVariant} 
        on:click={handleConfirm}
        {loading}
      >
        {confirmText}
      </Button>
    </div>
  </svelte:fragment>
</Modal>
