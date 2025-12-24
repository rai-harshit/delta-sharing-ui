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

  test('should delete a share', async ({ page }) => {
    // First create a share to delete
    const shareName = `delete_me_${Date.now()}`;
    await page.getByRole('button', { name: /create|add|new/i }).click();
    await page.getByRole('textbox', { name: 'Share Name' }).fill(shareName);
    await page.getByRole('button', { name: 'Create Share' }).click();
    await expect(page.getByText(shareName)).toBeVisible({ timeout: 10000 });
    
    // Find the share row and click the dropdown menu trigger (MoreHorizontal icon button)
    const row = page.locator('tr', { hasText: shareName });
    const menuTrigger = row.getByRole('button');
    await menuTrigger.click();
    
    // Click "Delete" in the dropdown menu
    await page.getByRole('menuitem', { name: /delete/i }).click();
    
    // Confirmation dialog should appear - click the destructive "Delete" button
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete' }).click();
    
    // Wait for dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    
    // Share should be removed from the table (check specifically in table, not anywhere on page)
    const table = page.locator('table');
    await expect(table.getByText(shareName)).not.toBeVisible({ timeout: 10000 });
  });
});
