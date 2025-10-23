import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
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
