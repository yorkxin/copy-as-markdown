import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Chrome extension testing
 *
 * See https://playwright.dev/docs/test-configuration
 */
const targetBrowser = process.env.PW_BROWSER?.toLowerCase() === 'firefox' ? 'firefox' : 'chromium';
const baseDevice = targetBrowser === 'firefox' ? devices['Desktop Firefox'] : devices['Desktop Chrome'];

function browserUse(overrides: Record<string, unknown> = {}) {
  const baseUse = {
    ...baseDevice,
    browserName: targetBrowser,
    ...(targetBrowser === 'chromium' ? { channel: 'chromium' } : {}),
  };
  return {
    ...baseUse,
    ...overrides,
  };
}

export default defineConfig({
  testDir: './test/e2e',

  // Maximum time one test can run for
  timeout: 10 * 1000,

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
      name: 'ui-tests',
      testDir: './test/e2e/ui',
      // Run UI tests in parallel (they don't use clipboard)
      fullyParallel: true,
      use: browserUse(),
    },
    {
      name: 'clipboard-tests',
      testDir: './test/e2e/clipboard',
      testIgnore: /clipboard-smoke\.spec\.ts/,
      // Run clipboard tests in parallel (using mock clipboard service)
      fullyParallel: true,
      use: browserUse(),
    },
    {
      name: 'clipboard-smoke',
      testDir: './test/e2e/clipboard',
      testMatch: /clipboard-smoke\.spec\.ts/,
      fullyParallel: false,
      workers: 1,
      dependencies: ['clipboard-tests'],
      use: browserUse(),
    },
    {
      name: 'permissions-tests',
      testDir: './test/e2e/permissions',
      fullyParallel: true,
      use: browserUse(),
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
