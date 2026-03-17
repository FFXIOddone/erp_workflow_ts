import { Toaster as HotToaster } from 'react-hot-toast';

/**
 * Enhanced Toast container with polish styling
 */
export function ToastContainer() {
  return (
    <HotToaster
      position="top-right"
      gutter={12}
      containerStyle={{
        top: 20,
        right: 20,
      }}
      toastOptions={{
        duration: 4000,
        style: {
          background: 'white',
          color: '#1f2937',
          padding: '12px 16px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          maxWidth: '400px',
        },
        success: {
          iconTheme: {
            primary: '#22c55e',
            secondary: '#fff',
          },
          style: {
            borderLeft: '4px solid #22c55e',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff',
          },
          style: {
            borderLeft: '4px solid #ef4444',
          },
        },
        loading: {
          iconTheme: {
            primary: '#3b82f6',
            secondary: '#e0e7ff',
          },
          style: {
            borderLeft: '4px solid #3b82f6',
          },
        },
      }}
    />
  );
}

export default ToastContainer;
