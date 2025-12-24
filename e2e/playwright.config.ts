import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Delta Sharing UI E2E Tests
 * 
 * Run tests with:
 *   pnpm test           - Run all tests
 *   pnpm test:headed    - Run with browser visible
 *   pnpm test:ui        - Open Playwright UI
 *   pnpm test:debug     - Debug mode
 */

export default defineConfig({
  testDir: './tests',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,
  
  /* Reporter to use */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  
  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video on failure */
    video: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.CI ? [
    // In CI, start backend (built) and frontend (dev) separately with proper env vars
    {
      command: 'cd ../apps/backend && node dist/app.js',
      url: 'http://localhost:5000/api/health',
      timeout: 120000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/delta_ui_e2e',
        JWT_SECRET: process.env.JWT_SECRET || 'e2e-test-secret-32-characters-long',
        ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        PORT: '5000',
        CORS_ORIGIN: 'http://localhost:3000',
      },
    },
    {
      command: 'cd ../apps/frontend && pnpm dev --host 0.0.0.0 --port 3000',
      url: 'http://localhost:3000',
      timeout: 120000,
      reuseExistingServer: false,
      env: {
        VITE_API_URL: 'http://localhost:5000',
      },
    },
  ] : {
    // For local dev, use the simple combined command
    command: 'cd .. && pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
});


