#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

const root = path.join(import.meta.dirname, '..');
const target = process.argv[2]; // 'chrome' | 'firefox-mv3'

if (target !== 'chrome' && target !== 'firefox-mv3') {
  console.error('✗ usage: node scripts/assert-no-clipboard-mock.js <chrome|firefox-mv3>');
  process.exit(1);
}

const distDir = path.join(root, target, 'dist');
if (!fs.existsSync(distDir)) {
  console.error(`✗ ${distDir} not found — run \`node scripts/build.js ${target}\` first`);
  process.exit(1);
}

// Strings that exist ONLY in e2e builds: clipboard mock internals and the listeners-ready flag.
// The build never minifies identifiers, so leaked e2e code keeps these verbatim.
const SENTINELS = ['mockClipboardCalls', '__mockClipboardService', 'createMockClipboardService', '__listenersReady'];

// .js ONLY — never .js.map: the sourcemap's `sourcesContent` embeds the full original
// clipboard-service.ts (including the tree-shaken mock), which is expected and not shipped logic.
function jsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...jsFiles(p));
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const offenders = [];
for (const file of jsFiles(distDir)) {
  const source = fs.readFileSync(file, 'utf8');
  for (const sentinel of SENTINELS) {
    if (source.includes(sentinel)) {
      offenders.push(`${path.relative(root, file)} (matched: ${sentinel})`);
    }
  }
}

if (offenders.length > 0) {
  console.error(`✗ clipboard mock leaked into ${target}/dist:`);
  for (const o of offenders) console.error(`  - ${o}`);
  console.error('  The e2e-only clipboard mock must be DCE-stripped from production bundles.');
  process.exit(1);
}
console.log(`✓ ${target}/dist is free of the clipboard mock`);
