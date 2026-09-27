import antfu from '@antfu/eslint-config';

export default antfu({
  typescript: true,

  yaml: false,
  markdown: false,

  // Stylistic rules replace a separate Prettier formatting pass.
  stylistic: {
    indent: 2,
    quotes: 'single',
    semi: true,
  },

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

  rules: {
    'no-console': 'off',

    'antfu/if-newline': 'off',
    'style/brace-style': ['error', '1tbs', { allowSingleLine: true }],
    'jsonc/sort-keys': 'off',

    'test/no-import-node-test': 'off',
    'perfectionist/sort-imports': 'off',
  },
});
