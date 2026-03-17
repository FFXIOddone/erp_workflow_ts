/**
 * SortConfig.svelte - Unit Tests
 */

import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, beforeEach } from 'vitest';
import SortConfig from '../../SortConfig.svelte';
import { mockSortConfig, createMockResponse } from '../mocks/testData';

describe('SortConfig', () => {
  beforeEach(() => {
    // Setup fetch mock that returns sort config data
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/sort-configs')) {
        return Promise.resolve(createMockResponse([mockSortConfig]));
      }
      return Promise.resolve(createMockResponse({ status: 'ok' }));
    });
  });

  it('renders the Sort Configuration title', async () => {
    render(SortConfig, { props: { brandId: 1 } });
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/sort.*config/i);
    });
  });

  it('shows save button', async () => {
    render(SortConfig, { props: { brandId: 1 } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });
  });

  it('shows reset button', async () => {
    render(SortConfig, { props: { brandId: 1 } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
    });
  });

  it('displays loading state initially', () => {
    render(SortConfig, { props: { brandId: 1 } });
    // Component should show loading spinner before data loads
    const spinners = document.querySelectorAll('.animate-spin');
    expect(spinners.length).toBeGreaterThanOrEqual(1);
  });
});
