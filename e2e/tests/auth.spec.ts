import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 */

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    // Check for login form elements
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    // Fill in invalid credentials
    await page.getByRole('textbox', { name: 'Email' }).fill('invalid@example.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('wrongpassword');
    
    // Click sign in
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should show error message
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 10000 });
  });

  test('should login with valid credentials', async ({ page }) => {
    // Fill in valid credentials (default admin)
    await page.getByRole('textbox', { name: 'Email' }).fill('admin@example.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('admin123');
    
    // Click sign in
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
  });

  test('should require email field', async ({ page }) => {
    // Leave email empty, fill password
    await page.getByRole('textbox', { name: 'Password' }).fill('somepassword');
    
    // Try to submit
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should still be on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should require password field', async ({ page }) => {
    // Fill email, leave password empty
    await page.getByRole('textbox', { name: 'Email' }).fill('test@example.com');
    
    // Try to submit
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should still be on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should navigate to recipient portal', async ({ page }) => {
    // Look for recipient portal link
    const recipientLink = page.getByRole('link', { name: /recipient|data consumer/i });
    
    if (await recipientLink.isVisible()) {
      await recipientLink.click();
      await expect(page).toHaveURL(/\/recipient/);
    }
  });
});

test.describe('Authenticated Admin', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill('admin@example.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
  });

  test('should access dashboard', async ({ page }) => {
    // Use heading role to be specific - avoid matching sidebar link
    await expect(page.getByRole('heading', { name: /dashboard/i, level: 1 })).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Click logout button directly (it's visible in sidebar)
    const logoutButton = page.getByRole('button', { name: /logout/i });
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('should navigate to shares page', async ({ page }) => {
    await page.getByRole('link', { name: /^shares$/i }).click();
    await expect(page).toHaveURL(/\/shares/);
  });

  test('should navigate to recipients page', async ({ page }) => {
    // Click the Recipients link in the sidebar navigation
    await page.locator('nav').getByRole('link', { name: /recipients/i }).click();
    await expect(page).toHaveURL(/\/recipients/);
  });
});
