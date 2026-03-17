import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Brand Management Flow
 * 
 * Tests CRUD operations for brands.
 */

test.describe('Brand Manager', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Brand Manager' }).click();
  });

  test('should display Brand Manager page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /brand.*manager/i })).toBeVisible();
  });

  test('should show existing brands', async ({ page }) => {
    // Default brand should be visible
    await expect(page.getByText('Kwik Fill')).toBeVisible();
  });

  test('should have Add Brand button', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /add.*brand/i });
    await expect(addButton).toBeVisible();
  });

  test('should open add brand modal', async ({ page }) => {
    await page.getByRole('button', { name: /add.*brand/i }).click();
    
    // Modal should appear with form
    await expect(page.getByPlaceholder(/brand.*name/i)).toBeVisible();
  });

  test('should close modal on cancel', async ({ page }) => {
    await page.getByRole('button', { name: /add.*brand/i }).click();
    await page.getByRole('button', { name: /cancel/i }).click();
    
    // Modal should be closed
    await expect(page.getByPlaceholder(/brand.*name/i)).not.toBeVisible();
  });

  test('should show edit button for each brand', async ({ page }) => {
    const editButtons = page.getByRole('button', { name: /edit/i });
    await expect(editButtons.first()).toBeVisible();
  });

  test('should show delete button for each brand', async ({ page }) => {
    const deleteButtons = page.getByRole('button', { name: /delete/i });
    await expect(deleteButtons.first()).toBeVisible();
  });

  test('should show brand statistics', async ({ page }) => {
    // Should show pattern count, store count, order count
    await expect(page.getByText(/pattern/i)).toBeVisible();
    await expect(page.getByText(/store/i)).toBeVisible();
  });
});

test.describe('Brand CRUD Operations', () => {
  test('should create a new brand', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Brand Manager' }).click();
    
    // Open add modal
    await page.getByRole('button', { name: /add.*brand/i }).click();
    
    // Fill form
    await page.getByPlaceholder(/brand.*name/i).fill('Test Brand E2E');
    await page.getByPlaceholder(/code/i).fill('TBE');
    
    // Submit
    await page.getByRole('button', { name: /save|create/i }).click();
    
    // Should show new brand in list
    await expect(page.getByText('Test Brand E2E')).toBeVisible({ timeout: 5000 });
  });

  test('should edit an existing brand', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Brand Manager' }).click();
    
    // Click edit on first brand
    await page.getByRole('button', { name: /edit/i }).first().click();
    
    // Modal should show with pre-filled data
    const nameInput = page.getByPlaceholder(/brand.*name/i);
    await expect(nameInput).toBeVisible();
    
    // Modify the description
    const descInput = page.getByPlaceholder(/description/i);
    await descInput.fill('Updated description via E2E test');
    
    // Save
    await page.getByRole('button', { name: /save|update/i }).click();
    
    // Should show success
    await expect(page.getByText(/updated|success/i)).toBeVisible({ timeout: 5000 });
  });
});
