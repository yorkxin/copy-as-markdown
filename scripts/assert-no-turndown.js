#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

const root = path.join(import.meta.dirname, '..');
const bundlePath = path.join(root, 'chrome', 'dist', 'background.js');

if (!fs.existsSync(bundlePath)) {
  console.error(`✗ ${bundlePath} not found — run \`node scripts/build.js chrome\` first`);
  process.exit(1);
}

const source = fs.readFileSync(bundlePath, 'utf8');
// `TurndownService` is the Turndown class identifier (real code, not a comment),
// so it survives only if Turndown is actually bundled. Reliable sentinel.
if (/TurndownService/.test(source)) {
  console.error('✗ Turndown leaked into chrome/dist/background.js (matched: TurndownService)');
  console.error('  The Chrome MV3 service worker must not bundle DOM-only Turndown code.');
  process.exit(1);
}
console.log('✓ chrome/dist/background.js is free of Turndown');
