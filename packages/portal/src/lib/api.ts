import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

const api = axios.create({
  baseURL: '/api/v1/portal',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export { api };

// Auth API
export const authApi = {
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),

  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    customerId: string;
  }) => api.post('/auth/register', data),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (data: { token: string; password: string }) =>
    api.post('/auth/reset-password', data),
};

// Profile API
export const profileApi = {
  get: () => api.get('/profile'),
  update: (data: { firstName?: string; lastName?: string; phone?: string }) =>
    api.put('/profile', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/profile/password', data),
};

// Orders API
export const ordersApi = {
  list: (params?: { page?: number; pageSize?: number; status?: string }) =>
    api.get('/orders', { params }),
  get: (id: string) => api.get(`/orders/${id}`),
};

// Proofs API
export const proofsApi = {
  list: () => api.get('/proofs'),
  get: (id: string) => api.get(`/proofs/${id}`),
  respond: (id: string, data: { status: string; comments?: string }) =>
    api.post(`/proofs/${id}/respond`, data),
};

// Messages API
export const messagesApi = {
  listThreads: () => api.get('/messages'),
  getThread: (threadId: string) => api.get(`/messages/thread/${threadId}`),
  send: (data: {
    subject?: string;
    content: string;
    orderId?: string;
    threadId?: string;
    attachments?: string[];
  }) => api.post('/messages', data),
  getUnreadCount: () => api.get('/messages/unread-count'),
};

// Dashboard API
export const dashboardApi = {
  get: () => api.get('/dashboard'),
};

// Notification Preferences API
export const notificationApi = {
  getPreferences: () => api.get('/notifications/preferences'),
  updatePreferences: (data: {
    preferences: Record<string, { emailEnabled: boolean; portalEnabled: boolean }>;
  }) => api.put('/notifications/preferences', data),
};

// Recurring Orders / Subscriptions API
export const recurringOrdersApi = {
  list: () => api.get('/recurring-orders'),
  get: (id: string) => api.get(`/recurring-orders/${id}`),
  pause: (id: string, reason?: string) => api.post(`/recurring-orders/${id}/pause`, { reason }),
  resume: (id: string) => api.post(`/recurring-orders/${id}/resume`),
};

// Self-Service Hub API
export const selfServiceApi = {
  // Artwork uploads - multipart form upload (recommended)
  uploadArtworkFile: (orderId: string, file: File, notes?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (notes) {
      formData.append('notes', notes);
    }
    return api.post(`/orders/${orderId}/artwork/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  // Artwork uploads - legacy JSON method (for pre-uploaded files)
  uploadArtwork: (orderId: string, data: {
    fileName: string;
    fileUrl: string;
    fileSize?: number;
    mimeType?: string;
    notes?: string;
  }) => api.post(`/orders/${orderId}/artwork`, data),
  getArtwork: (orderId: string) => api.get(`/orders/${orderId}/artwork`),

  // Proof annotations
  saveAnnotations: (proofId: string, data: {
    annotations: Array<{
      type: string;
      x: number;
      y: number;
      text?: string;
      color?: string;
      width?: number;
      height?: number;
    }>;
    imageDataUrl?: string;
  }) => api.post(`/proofs/${proofId}/annotations`, data),

  // Quick reorder
  reorder: (orderId: string, data?: {
    notes?: string;
    quantity?: number;
  }) => api.post(`/orders/${orderId}/reorder`, data || {}),

  // Brand assets - multipart form upload (recommended)
  uploadBrandAssetFile: (file: File, assetType?: string, description?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (assetType) {
      formData.append('assetType', assetType);
    }
    if (description) {
      formData.append('description', description);
    }
    return api.post('/brand-assets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  // Brand assets - legacy JSON method
  getBrandAssets: () => api.get('/brand-assets'),
  uploadBrandAsset: (data: {
    fileName: string;
    fileUrl: string;
    fileSize?: number;
    mimeType?: string;
    assetType?: string;
    description?: string;
  }) => api.post('/brand-assets', data),

  // Live production status
  getLiveStatus: (orderId: string) => api.get(`/orders/${orderId}/live-status`),
};

// Quote Engine API
export const quoteApi = {
  // Get product categories for quote builder
  getCategories: () => api.get('/quote/categories'),
  
  // Get products in a category
  getProducts: (categoryId?: string) => 
    api.get('/quote/products', { params: categoryId ? { categoryId } : {} }),
  
  // Calculate price for a line item
  calculatePrice: (data: {
    productId: string;
    quantity?: number;
    dimensions?: { width?: number; height?: number; length?: number };
  }) => api.post('/quote/calculate', data),
  
  // Upload custom artwork file
  uploadArtwork: (file: File) => {
    const formData = new FormData();
    formData.append('artwork', file);
    return api.post('/quote/artwork-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  // List customer's quotes
  list: (params?: { status?: string; page?: number; pageSize?: number }) =>
    api.get('/quotes', { params }),
  
  // Get quote detail
  get: (id: string) => api.get(`/quotes/${id}`),
  
  // Create new quote request
  create: (data: {
    items: Array<{
      productId?: string;
      description?: string;
      quantity?: number;
      unitPrice?: number;
      notes?: string;
    }>;
    notes?: string;
    description?: string;
    attachmentIds?: string[];
  }) => api.post('/quotes', data),
  
  // Approve a sent quote
  approve: (id: string) => api.post(`/quotes/${id}/approve`),
  
  // Reject a quote
  reject: (id: string, reason?: string) => 
    api.post(`/quotes/${id}/reject`, { reason }),
};

// Customer Intelligence API
export const intelligenceApi = {
  // Get customer intelligence overview with metrics and scores
  getOverview: () => api.get('/intelligence/overview'),
  
  // Get customer relationship timeline
  getTimeline: (limit = 50) => 
    api.get('/intelligence/timeline', { params: { limit } }),
  
  // Get spending and order trends
  getTrends: (months = 12) => 
    api.get('/intelligence/trends', { params: { months } }),
  
  // Get personalized recommendations
  getRecommendations: () => api.get('/intelligence/recommendations'),
};

// Payment History API (QuickBooks)
export const paymentApi = {
  // Get payment history
  list: (params?: { fromDate?: string; toDate?: string; page?: number; pageSize?: number }) =>
    api.get('/payments', { params }),
  
  // Get payment summary (totals and counts)
  getSummary: () => api.get('/payments/summary'),
};
