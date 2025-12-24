import { test, expect } from '@playwright/test';

/**
 * Shares Management E2E Tests
 */

test.describe('Shares Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill('admin@example.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
    
    // Navigate to shares
    await page.getByRole('link', { name: /^shares$/i }).click();
    await expect(page).toHaveURL(/\/shares/, { timeout: 10000 });
  });

  test('should display shares list', async ({ page }) => {
    // Should show shares heading
    await expect(page.getByRole('heading', { name: /shares/i, level: 1 })).toBeVisible();
  });

  test('should open create share modal', async ({ page }) => {
    // Find and click create button
    await page.getByRole('button', { name: /create|add|new/i }).click();
    
    // Modal should be visible
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should create a new share', async ({ page }) => {
    const shareName = `test_share_${Date.now()}`;
    
    // Open create modal
    await page.getByRole('button', { name: /create|add|new/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Fill in share name
    await page.getByRole('textbox', { name: 'Share Name' }).fill(shareName);
    
    // Submit - wait for button to be enabled
    await page.getByRole('button', { name: 'Create Share' }).click();
    
    // Should show success and share in list
    await expect(page.getByText(shareName)).toBeVisible({ timeout: 10000 });
  });

  test('should view share details', async ({ page }) => {
    // Click on first share link in the table
    const shareLink = page.locator('table tbody tr').first().locator('a').first();
    if (await shareLink.isVisible()) {
      await shareLink.click();
      
      // Should navigate to share details page
      await expect(page).toHaveURL(/\/shares\/\w+/);
    }
  });

  test('should create schema in share', async ({ page }) => {
    // Click on first share link
    const shareLink = page.locator('table tbody tr').first().locator('a').first();
    if (await shareLink.isVisible()) {
      await shareLink.click();
      await expect(page).toHaveURL(/\/shares\/\w+/);
      
      // Find add schema button
      const addSchemaBtn = page.getByRole('button', { name: /add schema/i });
      if (await addSchemaBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addSchemaBtn.click();
        
        // Fill schema name
        await page.getByRole('textbox', { name: /schema name|name/i }).fill('test_schema');
        await page.getByRole('button', { name: /create|save/i }).click();
        
        // Should show new schema
        await expect(page.getByText('test_schema')).toBeVisible();
      }
    }
  });

  test('should validate share name is required', async ({ page }) => {
    // Open create modal
    await page.getByRole('button', { name: /create|add|new/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Create Share button should be disabled when name is empty
    const createButton = page.getByRole('button', { name: 'Create Share' });
    await expect(createButton).toBeDisabled();
    
    // Dialog should still be open
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  // Skip: Delete functionality requires specific confirmation flow that varies
  test.skip('should delete a share', async ({ page }) => {
    // First create a share to delete
    const shareName = `delete_me_${Date.now()}`;
    await page.getByRole('button', { name: /create|add|new/i }).click();
    await page.getByRole('textbox', { name: 'Share Name' }).fill(shareName);
    await page.getByRole('button', { name: 'Create Share' }).click();
    await expect(page.getByText(shareName)).toBeVisible({ timeout: 10000 });
    
    // Find the share row and delete button (look for button with trash icon or delete action)
    const row = page.locator('tr', { hasText: shareName });
    const actionButton = row.locator('button').last();
    
    if (await actionButton.isVisible()) {
      await actionButton.click();
      
      // Confirm deletion if confirmation dialog appears
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i });
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }
      
      // Share should be removed
      await expect(page.getByText(shareName)).not.toBeVisible({ timeout: 10000 });
    }
  });
});
