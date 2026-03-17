/**
 * BrandManager.svelte - Unit Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import BrandManager from '../../BrandManager.svelte';
import { mockBrands, createMockResponse } from '../mocks/testData';

describe('BrandManager', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/brands')) {
        return Promise.resolve(createMockResponse(mockBrands));
      }
      return Promise.resolve(createMockResponse({ status: 'ok' }));
    });
  });

  it('renders the Brand Manager title', async () => {
    render(BrandManager);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Brand Manager');
  });

  it('displays Add Brand button', async () => {
    render(BrandManager);
    await waitFor(() => {
      expect(screen.getByText(/add.*brand/i)).toBeInTheDocument();
    });
  });

  it('opens add modal when clicking Add Brand', async () => {
    render(BrandManager);

    await waitFor(() => {
      const addButton = screen.getByText(/add.*brand/i);
      fireEvent.click(addButton);
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Kwik Fill/i)).toBeInTheDocument();
    });
  });
});
