/**
 * ProcessPDF.svelte - Unit Tests
 */

import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ProcessPDF from '../../ProcessPDF.svelte';

describe('ProcessPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore - Mock implementation for tests
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      })
    );
  });

  it('renders file upload area', () => {
    render(ProcessPDF, { props: { brandId: 1 } });
    expect(screen.getByText(/drop.*pdf.*here/i)).toBeInTheDocument();
  });

  it('shows file input for selecting PDFs', () => {
    render(ProcessPDF);
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('accept', '.pdf');
  });

  it('shows upload area with instructions', () => {
    render(ProcessPDF, { props: { brandId: 1 } });
    expect(screen.getByText(/click.*upload/i)).toBeInTheDocument();
  });

  it('renders the page title', () => {
    render(ProcessPDF, { props: { brandId: 1 } });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/process.*pdf/i);
  });
});
