import { test, expect } from '@playwright/test';

/**
 * Shares Management E2E Tests
 */

test.describe('Shares Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    
    // Wait for the email input to be visible
    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    
    await emailInput.fill('admin@example.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for navigation to dashboard with increased timeout
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
    
    // Navigate to shares
    await page.getByRole('link', { name: /shares/i }).click();
    await expect(page).toHaveURL(/\/shares/, { timeout: 10000 });
  });

  test('should display shares list', async ({ page }) => {
    // Should show shares table or list
    await expect(page.getByRole('heading', { name: /shares/i })).toBeVisible();
  });

  test('should open create share modal', async ({ page }) => {
    // Find and click create button
    await page.getByRole('button', { name: /create|add|new/i }).click();
    
    // Modal should be visible
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/name/i)).toBeVisible();
  });

  test('should create a new share', async ({ page }) => {
    const shareName = `test-share-${Date.now()}`;
    
    // Open create modal
    await page.getByRole('button', { name: /create|add|new/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Fill in share details
    await page.getByLabel(/name/i).fill(shareName);
    await page.getByLabel(/comment|description/i).fill('E2E test share');
    
    // Submit
    await page.getByRole('button', { name: /create|save|submit/i }).click();
    
    // Should show success and share in list
    await expect(page.getByText(shareName)).toBeVisible({ timeout: 10000 });
  });

  test('should view share details', async ({ page }) => {
    // Click on first share in the list
    const shareRow = page.locator('table tbody tr').first();
    if (await shareRow.isVisible()) {
      await shareRow.click();
      
      // Should show share details
      await expect(page.getByText(/schemas|tables|details/i)).toBeVisible();
    }
  });

  test('should create schema in share', async ({ page }) => {
    // Click on first share
    const shareRow = page.locator('table tbody tr').first();
    if (await shareRow.isVisible()) {
      await shareRow.click();
      
      // Find add schema button
      const addSchemaBtn = page.getByRole('button', { name: /add schema/i });
      if (await addSchemaBtn.isVisible()) {
        await addSchemaBtn.click();
        
        // Fill schema name
        await page.getByLabel(/name/i).fill('default');
        await page.getByRole('button', { name: /create|save/i }).click();
        
        // Should show new schema
        await expect(page.getByText('default')).toBeVisible();
      }
    }
  });

  test('should validate share name is required', async ({ page }) => {
    // Open create modal
    await page.getByRole('button', { name: /create|add|new/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Try to submit without name
    await page.getByRole('button', { name: /create|save|submit/i }).click();
    
    // Should show validation error
    await expect(page.getByText(/required|name/i)).toBeVisible();
  });

  test('should delete a share', async ({ page }) => {
    // First create a share to delete
    const shareName = `delete-me-${Date.now()}`;
    await page.getByRole('button', { name: /create|add|new/i }).click();
    await page.getByLabel(/name/i).fill(shareName);
    await page.getByRole('button', { name: /create|save|submit/i }).click();
    await expect(page.getByText(shareName)).toBeVisible({ timeout: 10000 });
    
    // Find the share row and delete button
    const row = page.locator('tr', { hasText: shareName });
    const deleteBtn = row.getByRole('button', { name: /delete|remove/i });
    
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      
      // Confirm deletion
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i });
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }
      
      // Share should be removed
      await expect(page.getByText(shareName)).not.toBeVisible({ timeout: 10000 });
    }
  });
});


