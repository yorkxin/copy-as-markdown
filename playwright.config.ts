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
  timeout: 10 * 1000,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter to use.
  // CI/Docker (CI=true): non-blocking reporters so the process always exits with a
  // real code — `list` streams progress to stdout, `json` writes a machine-readable
  // per-spec result an unattended agent can parse, and `html` with `open: 'never'`
  // generates the report WITHOUT serving it (the blocking serve is what made the
  // Docker container hang forever). Local dev keeps the auto-opening HTML report.
  reporter: process.env.CI
    ? [['list'], ['json', { outputFile: 'test-results/results.json' }], ['html', { open: 'never' }]]
    : 'html',

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
      name: 'parallel-tests',
      // All non-smoke tests can run together
      testDir: './test/e2e',
      testIgnore: /clipboard\//,
      fullyParallel: true,
      use: {
        ...devices['Desktop Chrome'],
        // IMPORTANT: Must use 'chromium' channel for extensions to work
        // Chrome and Edge removed command-line flags needed for side-loading
        channel: 'chromium',
      },
    },
    {
      name: 'clipboard-smoke',
      testDir: './test/e2e/clipboard',
      fullyParallel: false,
      workers: 1,
      use: {
        ...devices['Desktop Chrome'],
        // IMPORTANT: Must use 'chromium' channel for extensions to work
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
