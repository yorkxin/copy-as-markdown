#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';

const files = [
  { src: 'node_modules/turndown/lib/turndown.browser.es.js', dest: 'turndown.mjs' },
  { src: 'node_modules/@truto/turndown-plugin-gfm/lib/index.js', dest: 'turndown-plugin-gfm.mjs' },
  { src: 'node_modules/bulma/css/bulma.css', dest: 'bulma.css' },
  { src: 'node_modules/webextension-polyfill/dist/browser-polyfill.js', dest: 'browser-polyfill.js' },
  { src: 'node_modules/mustache/mustache.mjs', dest: 'mustache.mjs' },
];

const dir = path.join(import.meta.dirname, '..', 'src/vendor');

files.forEach(({ src, dest }) => {
  const filename = path.basename(dest);
  fs.copyFileSync(src, path.join(dir, filename));
});
