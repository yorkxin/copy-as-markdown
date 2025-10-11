#!/usr/bin/env node

/**
 * Copy third-party dependencies from node_modules to dist/vendor
 * This script copies the specific files needed for the web extension
 * so they can be bundled without needing to vendor files in src/
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const DEPENDENCIES = [
  {
    name: 'mustache',
    files: [
      { from: 'mustache.mjs', to: 'mustache.mjs' },
    ],
  },
  // Add more dependencies here as needed
  // Example:
  // {
  //   name: 'some-library',
  //   files: [
  //     { from: 'dist/index.js', to: 'some-library.js' },
  //   ],
  // },
];

const distVendorDir = path.join(import.meta.dirname, '..', 'dist', 'vendor');

// Ensure dist/vendor directory exists
if (!fs.existsSync(distVendorDir)) {
  fs.mkdirSync(distVendorDir, { recursive: true });
}

console.log('Copying dependencies from node_modules to dist/vendor...');

for (const dep of DEPENDENCIES) {
  const depPath = path.join(import.meta.dirname, '..', 'node_modules', dep.name);

  if (!fs.existsSync(depPath)) {
    console.warn(`Warning: ${dep.name} not found in node_modules`);
    continue;
  }

  for (const file of dep.files) {
    const sourcePath = path.join(depPath, file.from);
    const destPath = path.join(distVendorDir, file.to);

    if (!fs.existsSync(sourcePath)) {
      console.warn(`Warning: ${file.from} not found in ${dep.name}`);
      continue;
    }

    fs.copyFileSync(sourcePath, destPath);
    console.log(`  ✓ ${dep.name}/${file.from} → dist/vendor/${file.to}`);
  }
}

console.log('Dependencies copied successfully!');
