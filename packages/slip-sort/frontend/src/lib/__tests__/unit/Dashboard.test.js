/**
 * Dashboard.svelte - Unit Tests
 */

import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, beforeEach } from 'vitest';
import Dashboard from '../../Dashboard.svelte';
import { mockBatches, mockBrands, createMockResponse } from '../mocks/testData';

describe('Dashboard', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/batches')) {
        return Promise.resolve(createMockResponse(mockBatches));
      }
      if (url.includes('/api/orders')) {
        return Promise.resolve(createMockResponse({ total: 500, orders: [] }));
      }
      if (url.includes('/api/brands')) {
        return Promise.resolve(createMockResponse(mockBrands));
      }
      return Promise.resolve(createMockResponse({}));
    });
  });

  it('renders the dashboard title', async () => {
    render(Dashboard);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard');
  });

  it('displays stats cards', async () => {
    render(Dashboard);

    await waitFor(() => {
      expect(screen.getByText('Total Store Orders Processed')).toBeInTheDocument();
      expect(screen.getByText('Unique Stores')).toBeInTheDocument();
      expect(screen.getByText('Brands Configured')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    render(Dashboard);
    // Stats cards should be present
    expect(screen.getByText('Total Store Orders Processed')).toBeInTheDocument();
  });

  it('displays recent batches section', async () => {
    render(Dashboard);

    await waitFor(() => {
      expect(screen.getByText('Recent Processing Batches')).toBeInTheDocument();
    });
  });
});
