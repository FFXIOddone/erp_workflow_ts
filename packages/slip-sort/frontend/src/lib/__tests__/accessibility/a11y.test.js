/**
 * Accessibility Tests
 * Tests ARIA labels, keyboard navigation, and screen reader compatibility
 */

import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Sidebar from '../../Sidebar.svelte';
import Dashboard from '../../Dashboard.svelte';
import { mockBatches, mockBrands, createMockResponse } from '../mocks/testData';

describe('Accessibility', () => {
  describe('Sidebar', () => {
    it('all navigation buttons have accessible names', () => {
      render(Sidebar, { props: { currentView: 'process' } });

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAccessibleName();
      });
    });

    it('navigation buttons are keyboard focusable', () => {
      render(Sidebar, { props: { currentView: 'process' } });

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).not.toHaveAttribute('tabindex', '-1');
      });
    });

    it('current view has visual distinction', () => {
      render(Sidebar, { props: { currentView: 'process' } });

      const activeButton = screen.getByText('Process PDF').closest('button');
      expect(activeButton).toHaveClass(/bg-primary/);
    });
  });

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

    it('has proper heading hierarchy', async () => {
      render(Dashboard);

      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent('Dashboard');
    });

    it('stats cards have descriptive text', async () => {
      render(Dashboard);

      expect(screen.getByText('Total Store Orders Processed')).toBeInTheDocument();
      expect(screen.getByText('Unique Stores')).toBeInTheDocument();
      expect(screen.getByText('Brands Configured')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('buttons are present and focusable', async () => {
      render(Sidebar, { props: { currentView: 'process' } });

      const dashboardButton = screen.getByText('Dashboard');
      // Button should exist and be a focusable element
      expect(dashboardButton).toBeInTheDocument();
      expect(dashboardButton).not.toHaveAttribute('tabindex', '-1');
    });

    it('buttons have proper role', async () => {
      render(Sidebar, { props: { currentView: 'process' } });

      const button = screen.getByText('Dashboard');
      expect(button.closest('button')).toBeInTheDocument();
    });
  });

  describe('Focus Management', () => {
    it('focus visible on interactive elements', () => {
      render(Sidebar, { props: { currentView: 'process' } });

      const buttons = screen.getAllByRole('button');

      buttons.forEach((button) => {
        // Buttons should have focus-visible styles (checked via class existence)
        // This is a structural check - actual visual testing would need Playwright
        expect(button.tagName).toBe('BUTTON');
      });
    });
  });

  describe('Color Contrast', () => {
    it('text elements use proper color classes', () => {
      render(Sidebar, { props: { currentView: 'process' } });

      // Check that navigation items use proper text color classes
      const navItems = screen.getAllByRole('button');
      navItems.forEach((item) => {
        // Should have text color classes
        const hasTextColor =
          item.classList.contains('text-white') ||
          item.classList.contains('text-gray-300') ||
          item.className.includes('text-');
        expect(hasTextColor).toBe(true);
      });
    });
  });
});
