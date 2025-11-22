#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';

const vendorDir = path.join(import.meta.dirname, '..', 'src/vendor');

const files = [
  { src: 'node_modules/turndown/dist/turndown.js' },
  { src: 'node_modules/bulma/css/bulma.css' },
  { src: 'node_modules/webextension-polyfill/dist/browser-polyfill.js' },
  { src: 'node_modules/mustache/mustache.mjs' },
  { src: 'node_modules/uhtml/index.js', dest: 'uhtml.js' },
];

files.forEach(({ src, dest }) => {
  const filename = dest ?? path.basename(src);
  fs.copyFileSync(src, path.join(vendorDir, filename));
});
