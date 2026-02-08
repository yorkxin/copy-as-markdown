import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/**/*.test.ts'],
          exclude: ['test/ui/**/*.spec.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'browser',
          include: ['test/ui/**/*.spec.ts'],
          testTimeout: 1000,
          browser: {
            enabled: true,
            headless: true,
            provider: 'playwright',
            // https://vitest.dev/guide/browser/playwright
            instances: [
              { browser: 'chromium' },
              // TODO: Playwright container on GitHub Actions refuses to run Firefox
              // even with -e HOME=/root or -w /root workarounds, as suggested in the doc.
              // Also tried to run with --user=1001 but that prevents installing xsel clipboard tool.
              // Need to find another workaround before Firefox can be enabled on CI :/
              // { browser: 'firefox' },
            ],
          },
        },
      },
    ],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
    },
    mockReset: true, // Auto-reset mocks between tests
    restoreMocks: true, // Auto-restore mocks
    clearMocks: true, // Auto-clear mock history
  },
});
