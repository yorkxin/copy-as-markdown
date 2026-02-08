import antfu from '@antfu/eslint-config';

export default antfu({
  // Enable TypeScript support
  typescript: true,

  yaml: false,
  markdown: false,

  // Formatter settings - replaces Prettier
  stylistic: {
    indent: 2,
    quotes: 'single',
    semi: true,
  },

  // Ignore patterns
  ignores: [
    'firefox/dist/**',
    'chrome/dist/**',
    'firefox-mv3/dist/**',
    '**/vendor/**',
    'e2e_test/**',
    'dist/**',
    'build/**',
    'activate', // python libraries
    '.zed/**',
  ],

  // Rule overrides
  rules: {
    // Allow console statements (common in browser extensions)
    'no-console': 'off',

    // Less strict than default
    'antfu/if-newline': 'off',
    'style/brace-style': ['error', '1tbs', { allowSingleLine: true }],
    'jsonc/sort-keys': 'off',

    'test/no-import-node-test': 'off',
    'perfectionist/sort-imports': 'off',
  },
});
