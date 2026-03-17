<script>
  import { Toaster } from 'svelte-sonner';
</script>

<!-- 
  Toast Notification Provider
  Import this component once at the app level (App.svelte)
  
  Usage:
  import { toast } from '$lib/components/toast';
  
  toast.success('Item saved successfully!');
  toast.error('Failed to save item');
  toast.info('Processing your request...');
  toast.warning('This action cannot be undone');
-->

<Toaster
  position="bottom-right"
  richColors
  closeButton
  theme="system"
  toastOptions={{
    style: 'font-family: inherit;',
    duration: 4000,
  }}
/>
