/**
 * Toast Notification Utility
 *
 * A wrapper around svelte-sonner for consistent toast notifications
 *
 * Usage:
 *   import { toast } from '$lib/components/toast';
 *
 *   toast.success('Saved!');
 *   toast.error('Something went wrong');
 *   toast.info('Processing...');
 *   toast.warning('Are you sure?');
 *   toast.promise(asyncFunction, { loading, success, error });
 */

import { toast as sonnerToast } from 'svelte-sonner';

export const toast = {
  /**
   * Show a success toast
   * @param {string} message - The message to display
   * @param {object} options - Optional toast options
   */
  success: (message, options = {}) => {
    sonnerToast.success(message, {
      duration: 4000,
      ...options,
    });
  },

  /**
   * Show an error toast
   * @param {string} message - The message to display
   * @param {object} options - Optional toast options
   */
  error: (message, options = {}) => {
    sonnerToast.error(message, {
      duration: 6000,
      ...options,
    });
  },

  /**
   * Show an info toast
   * @param {string} message - The message to display
   * @param {object} options - Optional toast options
   */
  info: (message, options = {}) => {
    sonnerToast.info(message, {
      duration: 4000,
      ...options,
    });
  },

  /**
   * Show a warning toast
   * @param {string} message - The message to display
   * @param {object} options - Optional toast options
   */
  warning: (message, options = {}) => {
    sonnerToast.warning(message, {
      duration: 5000,
      ...options,
    });
  },

  /**
   * Show a loading toast that updates based on promise result
   * @template T
   * @param {Promise<T>} promise - The promise to track
   * @param {{loading?: string, success?: string, error?: string}} messages - Toast messages
   */
  promise: (promise, messages) => {
    return sonnerToast.promise(promise, {
      loading: messages.loading || 'Loading...',
      success: messages.success || 'Success!',
      error: messages.error || 'Something went wrong',
    });
  },

  /**
   * Dismiss a specific toast or all toasts
   * @param {string|number} toastId - Optional toast ID to dismiss
   */
  dismiss: (toastId) => {
    sonnerToast.dismiss(toastId);
  },

  /**
   * Show a custom toast
   * @param {string} message - The message to display
   * @param {object} options - Toast options
   */
  custom: (message, options = {}) => {
    sonnerToast(message, options);
  },
};

export default toast;
