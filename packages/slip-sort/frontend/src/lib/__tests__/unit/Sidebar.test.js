/**
 * Sidebar.svelte - Unit Tests
 */

import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from '../../Sidebar.svelte';

describe('Sidebar', () => {
  const primaryItems = [
    'Process PDF',
    'Sort Configuration',
    'Blackout Rules',
    'Wobbler Kits',
    'Generate Output',
  ];
  const secondaryItems = ['Dashboard', 'Pattern Builder', 'Order History', 'Brand Manager'];

  it('renders the app title', () => {
    render(Sidebar, { props: { currentView: 'process' } });
    expect(screen.getByText('Packing Slip Manager')).toBeInTheDocument();
  });

  it('displays version number', () => {
    render(Sidebar, { props: { currentView: 'process' } });
    expect(screen.getByText('v2.0')).toBeInTheDocument();
  });

  it('renders all primary navigation items', () => {
    render(Sidebar, { props: { currentView: 'process' } });

    primaryItems.forEach((item) => {
      expect(screen.getByText(item)).toBeInTheDocument();
    });
  });

  it('renders all secondary navigation items', () => {
    render(Sidebar, { props: { currentView: 'process' } });

    secondaryItems.forEach((item) => {
      expect(screen.getByText(item)).toBeInTheDocument();
    });
  });

  it('highlights the current view', () => {
    render(Sidebar, { props: { currentView: 'sorting' } });

    const sortButton = screen.getByText('Sort Configuration').closest('button');
    expect(sortButton).toHaveClass('bg-primary-600');
  });

  it('emits navigate event when clicking a nav item', async () => {
    const { component } = render(Sidebar, { props: { currentView: 'process' } });

    const navigateMock = vi.fn();
    component.$on('navigate', navigateMock);

    const dashboardButton = screen.getByText('Dashboard');
    await fireEvent.click(dashboardButton);

    expect(navigateMock).toHaveBeenCalledWith(expect.objectContaining({ detail: 'dashboard' }));
  });

  it('renders Workflow section header', () => {
    render(Sidebar, { props: { currentView: 'process' } });
    expect(screen.getByText('Workflow')).toBeInTheDocument();
  });

  it('renders Management section header', () => {
    render(Sidebar, { props: { currentView: 'process' } });
    expect(screen.getByText('Management')).toBeInTheDocument();
  });

  it('displays footer with copyright', () => {
    render(Sidebar, { props: { currentView: 'process' } });
    expect(screen.getByText(/2026 Wilde Signs/)).toBeInTheDocument();
  });

  it('all nav buttons are keyboard accessible', () => {
    render(Sidebar, { props: { currentView: 'process' } });

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(10); // 5 primary + 4 secondary + 1 theme toggle

    buttons.forEach((button) => {
      expect(button).not.toHaveAttribute('tabindex', '-1');
    });
  });
});
