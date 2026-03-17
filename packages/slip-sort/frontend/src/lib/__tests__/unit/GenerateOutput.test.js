/**
 * GenerateOutput.svelte - Unit Tests
 */

import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, beforeEach } from 'vitest';
import GenerateOutput from '../../GenerateOutput.svelte';
import {
  mockBatches,
  mockSortConfig,
  mockBlackoutRules,
  createMockResponse,
} from '../mocks/testData';

describe('GenerateOutput', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/batches')) {
        return Promise.resolve(createMockResponse(mockBatches));
      }
      if (url.includes('/api/sort-configs')) {
        return Promise.resolve(createMockResponse([mockSortConfig]));
      }
      if (url.includes('/api/blackout-rules')) {
        return Promise.resolve(createMockResponse(mockBlackoutRules));
      }
      return Promise.resolve(createMockResponse({ status: 'ok' }));
    });
  });

  it('renders the Generate Output title', async () => {
    render(GenerateOutput, /** @type {any} */ ({ props: { brandId: 1 } }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/generate.*output/i);
    });
  });

  it('shows batch selector', async () => {
    render(GenerateOutput, /** @type {any} */ ({ props: { brandId: 1 } }));

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  it('shows initial loading or empty state', async () => {
    render(GenerateOutput, /** @type {any} */ ({ props: { brandId: 1 } }));
    // Should show either loading or "No Batch Selected"
    const hasLoadingOrEmpty =
      document.querySelectorAll('.animate-spin').length > 0 ||
      screen.queryByText(/no batch selected/i) !== null ||
      screen.queryByText(/select a batch/i) !== null;
    expect(hasLoadingOrEmpty).toBe(true);
  });
});
