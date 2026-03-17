/**
 * BlackoutConfig.svelte - Unit Tests
 */

import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, beforeEach } from 'vitest';
import BlackoutConfig from '../../BlackoutConfig.svelte';
import { mockBlackoutRules, createMockResponse } from '../mocks/testData';

describe('BlackoutConfig', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/blackout-rules')) {
        return Promise.resolve(createMockResponse(mockBlackoutRules));
      }
      return Promise.resolve(createMockResponse({ status: 'ok' }));
    });
  });

  it('renders the Blackout Rules title', async () => {
    render(BlackoutConfig, { props: { brandId: 1 } });
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/blackout/i);
    });
  });

  it('shows save rule button', async () => {
    render(BlackoutConfig, { props: { brandId: 1 } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save.*rule/i })).toBeInTheDocument();
    });
  });

  it('displays loading state initially', () => {
    render(BlackoutConfig, { props: { brandId: 1 } });
    // Component should show loading spinner before data loads
    const spinners = document.querySelectorAll('.animate-spin');
    expect(spinners.length).toBeGreaterThanOrEqual(1);
  });
});
