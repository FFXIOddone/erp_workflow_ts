/**
 * OrderHistory.svelte - Unit Tests
 */

import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, beforeEach } from 'vitest';
import OrderHistory from '../../OrderHistory.svelte';
import { mockBatches, mockOrders, createMockResponse } from '../mocks/testData';

describe('OrderHistory', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/orders/history') || url.includes('/api/batches')) {
        return Promise.resolve(createMockResponse(mockBatches));
      }
      if (url.includes('/api/stores')) {
        return Promise.resolve(createMockResponse([]));
      }
      if (url.includes('/api/orders')) {
        return Promise.resolve(createMockResponse({ orders: mockOrders, total: 2 }));
      }
      return Promise.resolve(createMockResponse({}));
    });
  });

  it('renders the Order History title', async () => {
    render(OrderHistory, /** @type {any} */ ({ props: { brandId: 1 } }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/order.*history/i);
    });
  });

  it('shows search input', async () => {
    render(OrderHistory, /** @type {any} */ ({ props: { brandId: 1 } }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    });
  });

  it('shows refresh button', async () => {
    render(OrderHistory, /** @type {any} */ ({ props: { brandId: 1 } }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });
  });

  it('displays loading state initially', () => {
    render(OrderHistory, /** @type {any} */ ({ props: { brandId: 1 } }));
    // Component should show loading spinner before data loads
    const spinners = document.querySelectorAll('.animate-spin');
    expect(spinners.length).toBeGreaterThanOrEqual(1);
  });
});
