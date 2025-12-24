import { test, expect } from '@playwright/test';

/**
 * Recipient Portal E2E Tests
 */

// Test token created in seed.ts - this is a known token for E2E tests
const TEST_RECIPIENT_TOKEN = 'e2e_test_token_1234567890abcdef1234567890abcdef1234567890abcdef';
const TEST_CREDENTIAL = {
  shareCredentialsVersion: 1,
  endpoint: 'http://localhost:5000/api/delta',
  bearerToken: TEST_RECIPIENT_TOKEN,
};

test.describe('Recipient Portal', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to recipient portal
    await page.goto('/recipient/login');
  });

  test('should display credential input form', async ({ page }) => {
    // Should show heading for recipient portal
    await expect(page.getByRole('heading', { name: /recipient portal/i })).toBeVisible();
    // Should show tabs for upload and paste
    await expect(page.getByRole('tab', { name: /upload file/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /paste json/i })).toBeVisible();
  });

  test('should accept credential file upload', async ({ page }) => {
    // File input is hidden but exists for the drop zone
    const fileInput = page.locator('input[type="file"]');
    
    // Create a mock credential file
    await fileInput.setInputFiles({
      name: 'config.share',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(TEST_CREDENTIAL)),
    });
    
    // Should show success indicator - "Credential loaded" and endpoint
    await expect(page.getByText(/credential loaded/i)).toBeVisible();
    await expect(page.getByText(TEST_CREDENTIAL.endpoint)).toBeVisible();
    // Connect button should now be enabled
    await expect(page.getByRole('button', { name: /connect/i })).toBeEnabled();
  });

  test('should accept pasted JSON credentials', async ({ page }) => {
    // Click the paste tab
    await page.getByRole('tab', { name: /paste json/i }).click();
    
    // Find the textarea and paste credentials
    const textarea = page.locator('textarea');
    await textarea.fill(JSON.stringify(TEST_CREDENTIAL, null, 2));
    
    // Should show valid credential indicator
    await expect(page.getByText(/valid credential/i)).toBeVisible();
    // Connect button should now be enabled
    await expect(page.getByRole('button', { name: /connect/i })).toBeEnabled();
  });

  test('should show error for invalid token', async ({ page }) => {
    // Click paste tab
    await page.getByRole('tab', { name: /paste json/i }).click();
    
    // Paste invalid credentials
    const invalidCredential = {
      ...TEST_CREDENTIAL,
      bearerToken: 'invalid-token-that-will-fail',
    };
    
    const textarea = page.locator('textarea');
    await textarea.fill(JSON.stringify(invalidCredential, null, 2));
    
    // Click connect
    await page.getByRole('button', { name: /connect/i }).click();
    
    // Should show error (in toast or on page)
    await expect(page.getByText(/invalid|unauthorized|error|failed|denied/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Authenticated Recipient', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to recipient portal and authenticate
    await page.goto('/recipient/login');
    
    // Click paste tab
    await page.getByRole('tab', { name: /paste json/i }).click();
    
    // Paste valid credentials
    const textarea = page.locator('textarea');
    await textarea.fill(JSON.stringify(TEST_CREDENTIAL, null, 2));
    
    // Click connect
    await page.getByRole('button', { name: /connect/i }).click();
    
    // Wait for navigation to shares page
    await expect(page).toHaveURL(/\/recipient\/shares/, { timeout: 30000 });
  });

  test('should list available shares', async ({ page }) => {
    // Should show sales_data share that demo_recipient has access to
    await expect(page.getByRole('button', { name: /sales_data/i })).toBeVisible();
  });

  test('should browse share contents', async ({ page }) => {
    // Click on sales_data share to expand/view it
    await page.getByRole('button', { name: /sales_data/i }).click();
    
    // Should expand and show schema names (transactions, customers)
    await expect(page.getByText(/transactions|customers/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('should show share details', async ({ page }) => {
    // Should show Available Shares heading
    await expect(page.getByRole('heading', { name: /available shares/i })).toBeVisible();
    // Should show sales_data share button with schema count
    await expect(page.getByRole('button', { name: /sales_data.*schema/i })).toBeVisible();
  });
});
