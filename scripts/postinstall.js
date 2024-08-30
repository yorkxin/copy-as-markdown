#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';

const files = [
  'node_modules/turndown/dist/turndown.js',
  'node_modules/bulma/css/bulma.css',
  'node_modules/webextension-polyfill/dist/browser-polyfill.js',
  'node_modules/mustache/mustache.mjs',
];

const dir = path.join(import.meta.dirname, '..', 'src/vendor');

files.forEach((file) => {
  const filename = path.basename(file);
  fs.copyFileSync(file, path.join(dir, filename));
});
