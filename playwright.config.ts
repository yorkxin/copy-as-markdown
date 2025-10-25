import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Chrome extension testing
 *
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './test/e2e',

  // Maximum time one test can run for
  timeout: 30 * 1000,

  // Cannot run tests in files in parallel because there is only one system clipboard
  workers: 1,
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter to use
  reporter: 'html',

  // Shared settings for all the projects below
  use: {
    // Base URL for test pages
    baseURL: 'http://localhost:5566',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
        // IMPORTANT: Must use 'chromium' channel for extensions to work
        // Chrome and Edge removed command-line flags needed for side-loading
        channel: 'chromium',
      },
    },
  ],

  // Run local dev server before starting the tests
  // Uncomment if you want to auto-start fixture server
  webServer: {
    command: 'npx http-server fixtures -p 5566 -c-1',
    url: 'http://localhost:5566',
    reuseExistingServer: !process.env.CI,
  },
});
