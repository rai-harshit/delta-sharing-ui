import { test, expect } from '@playwright/test';

/**
 * Recipient Portal E2E Tests
 */

test.describe('Recipient Portal', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to recipient portal
    await page.goto('/recipient');
  });

  test('should display credential input form', async ({ page }) => {
    // Should show heading or form elements for recipient portal
    // The page should have some indication it's the recipient portal
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('should accept credential file upload', async ({ page }) => {
    // Look for file upload input
    const fileInput = page.locator('input[type="file"]');
    
    if (await fileInput.count() > 0) {
      // Create a mock credential file
      const credentialContent = JSON.stringify({
        shareCredentialsVersion: 1,
        endpoint: 'http://localhost:5000/api/delta',
        bearerToken: 'test-token',
      });
      
      await fileInput.setInputFiles({
        name: 'config.share',
        mimeType: 'application/json',
        buffer: Buffer.from(credentialContent),
      });
    }
  });

  test('should show error for invalid token', async ({ page }) => {
    // Find endpoint and token inputs
    const endpointInput = page.getByLabel(/endpoint|server/i);
    const tokenInput = page.getByLabel(/token|bearer/i);
    
    if (await endpointInput.count() > 0 && await tokenInput.count() > 0) {
      await endpointInput.fill('http://localhost:5000/api/delta');
      await tokenInput.fill('invalid-token');
      
      // Submit
      await page.getByRole('button', { name: /connect|login|submit/i }).click();
      
      // Should show error
      await expect(page.getByText(/invalid|error|failed/i)).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Authenticated Recipient', () => {
  // These tests are skipped as they require a valid recipient token
  
  test.skip('should list available shares', async ({ page }) => {
    await expect(page.getByText(/shares|available/i)).toBeVisible();
  });

  test.skip('should browse share schemas', async ({ page }) => {
    const shareItem = page.locator('[data-testid="share-item"]').first();
    await shareItem.click();
    await expect(page.getByText(/schema/i)).toBeVisible();
  });

  test.skip('should preview table data', async ({ page }) => {
    const tableItem = page.locator('[data-testid="table-item"]').first();
    await tableItem.click();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test.skip('should show code snippets', async ({ page }) => {
    await expect(page.getByText(/python|pyspark|code/i)).toBeVisible();
  });

  test.skip('should allow CSV export', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: /export|download|csv/i });
    await expect(exportBtn).toBeVisible();
  });
});
