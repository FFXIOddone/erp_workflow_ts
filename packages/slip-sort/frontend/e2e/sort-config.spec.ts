import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Sort Configuration Flow
 * 
 * Tests the sort configuration management including
 * tier ordering, category management, and persistence.
 */

test.describe('Sort Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sort Configuration' }).click();
  });

  test('should display Sort Configuration page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /sort.*config/i })).toBeVisible();
  });

  test('should show tier list', async ({ page }) => {
    // Should show default tiers
    await expect(page.getByText('Kit Type')).toBeVisible();
    await expect(page.getByText('Alcohol Type')).toBeVisible();
    await expect(page.getByText('Location')).toBeVisible();
  });

  test('should have save button', async ({ page }) => {
    const saveButton = page.getByRole('button', { name: /save/i });
    await expect(saveButton).toBeVisible();
  });

  test('should have reset button', async ({ page }) => {
    const resetButton = page.getByRole('button', { name: /reset/i });
    await expect(resetButton).toBeVisible();
  });

  test('should toggle tier enabled state', async ({ page }) => {
    // Find a tier toggle checkbox
    const tierToggle = page.locator('input[type="checkbox"]').first();
    
    const initialState = await tierToggle.isChecked();
    await tierToggle.click();
    
    const newState = await tierToggle.isChecked();
    expect(newState).not.toBe(initialState);
  });

  test('should show category list for each tier', async ({ page }) => {
    // Kit Type tier should show categories
    await expect(page.getByText(/counter.*shipper/i)).toBeVisible();
  });

  test('should allow adding new category', async ({ page }) => {
    // Look for add category button
    const addButton = page.getByRole('button', { name: /add.*category/i });
    
    if (await addButton.isVisible()) {
      await addButton.click();
      // Should show input for new category
      await expect(page.locator('input[placeholder*="category" i]')).toBeVisible();
    }
  });
});

test.describe('Sort Configuration Persistence', () => {
  test('should save configuration changes', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sort Configuration' }).click();
    
    // Make a change (toggle a tier)
    const tierToggle = page.locator('input[type="checkbox"]').first();
    await tierToggle.click();
    
    // Save
    const saveButton = page.getByRole('button', { name: /save/i });
    await saveButton.click();
    
    // Should show success feedback
    await expect(page.getByText(/saved|success/i)).toBeVisible({ timeout: 5000 });
  });
});
