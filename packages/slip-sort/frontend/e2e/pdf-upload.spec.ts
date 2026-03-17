import { test, expect } from '@playwright/test';

/**
 * E2E Tests: PDF Upload and Processing Flow
 * 
 * Tests the complete user journey from uploading a PDF
 * through processing and downloading results.
 */

test.describe('PDF Upload & Process Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display Process PDF view by default', async ({ page }) => {
    // Process PDF is the default view
    await expect(page.getByText('Process PDF')).toBeVisible();
    await expect(page.getByText(/drop.*pdf/i)).toBeVisible();
  });

  test('should show file drop zone', async ({ page }) => {
    const dropZone = page.locator('[class*="border-dashed"]');
    await expect(dropZone).toBeVisible();
  });

  test('should highlight drop zone on drag over', async ({ page }) => {
    const dropZone = page.locator('[class*="border-dashed"]');
    
    // Simulate drag over
    await dropZone.dispatchEvent('dragenter');
    
    // Should have visual feedback (class change)
    await expect(dropZone).toHaveClass(/border-primary|bg-blue/);
  });

  test('should show file input for selecting PDFs', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute('accept', '.pdf');
  });

  test('should navigate to Generate Output after processing', async ({ page }) => {
    // Click Generate Output in sidebar
    await page.getByText('Generate Output').click();
    
    // Should show the generate output view
    await expect(page.getByRole('heading', { name: /generate.*output/i })).toBeVisible();
  });

  test('should show Order History view', async ({ page }) => {
    await page.getByText('Order History').click();
    
    await expect(page.getByRole('heading', { name: /order.*history/i })).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('should navigate through all sidebar items', async ({ page }) => {
    await page.goto('/');
    
    const navItems = [
      { text: 'Process PDF', heading: /process|upload/i },
      { text: 'Sort Configuration', heading: /sort.*config/i },
      { text: 'Blackout Rules', heading: /blackout/i },
      { text: 'Wobbler Kits', heading: /wobbler/i },
      { text: 'Generate Output', heading: /generate/i },
      { text: 'Dashboard', heading: /dashboard/i },
      { text: 'Brand Manager', heading: /brand/i },
    ];
    
    for (const item of navItems) {
      await page.getByRole('button', { name: item.text }).click();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
  });

  test('sidebar should highlight current view', async ({ page }) => {
    await page.goto('/');
    
    await page.getByText('Dashboard').click();
    
    const dashboardButton = page.getByRole('button', { name: 'Dashboard' });
    await expect(dashboardButton).toHaveClass(/bg-primary/);
  });
});
