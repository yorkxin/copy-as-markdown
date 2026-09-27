import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';

// Playwright extension configuration:
// https://playwright.dev/docs/chrome-extensions
export default defineConfig({
  testDir: './test/e2e',

  timeout: 10 * 1000,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  // CI reporters stream progress, write machine-readable results, and generate HTML
  // without serving it; local runs use the interactive HTML reporter.
  reporter: process.env.CI
    ? [['list'], ['json', { outputFile: 'test-results/results.json' }], ['html', { open: 'never' }]]
    : 'html',

  use: {
    baseURL: 'http://localhost:5566',

    trace: 'on-first-retry',

    screenshot: 'only-on-failure',

    video: 'retain-on-failure',
  },

  // Extensions require the Chromium channel because Chrome and Edge no longer accept
  // the command-line flags used for sideloading.
  projects: [
    {
      name: 'parallel-tests',
      testDir: './test/e2e',
      testIgnore: /clipboard\//,
      fullyParallel: true,
      use: {
        ...devices['Desktop Chrome'],
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
        channel: 'chromium',
      },
    },
  ],

  webServer: {
    command: 'npx http-server fixtures -p 5566 -c-1',
    url: 'http://localhost:5566',
    reuseExistingServer: !process.env.CI,
  },
});
