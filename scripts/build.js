#!/usr/bin/env node
import * as path from 'node:path';
import process from 'node:process';
import { buildExtension } from './lib/build-extension.js';

const root = path.join(import.meta.dirname, '..');
const target = process.argv[2]; // 'chrome' | 'firefox-mv3'
const watch = process.argv.includes('--watch');

await buildExtension({
  target,
  outdir: path.join(root, target, 'dist'),
  profile: 'production',
  watch,
});
