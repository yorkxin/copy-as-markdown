#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const MANIFESTS = {
  chrome: path.join(root, 'chrome', 'manifest.json'),
  firefox: path.join(root, 'firefox-mv3', 'manifest.json'),
};

const BUMP_TYPES = ['major', 'minor', 'patch'];
const TARGETS = ['chrome', 'firefox'];

function bumpVersion(version, type) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  if (type === 'patch') return `${major}.${minor}.${patch + 1}`;
}

const bumpType = process.argv[2];
const targetArg = process.argv[3];

if (!BUMP_TYPES.includes(bumpType) || (targetArg && !TARGETS.includes(targetArg))) {
  console.error(`Usage: bump-version.js <${BUMP_TYPES.join('|')}> [${TARGETS.join('|')}]`);
  process.exit(1);
}

const targets = targetArg ? [targetArg] : TARGETS;
const sourceManifest = JSON.parse(fs.readFileSync(MANIFESTS[targets[0]], 'utf-8'));
const currentVersion = sourceManifest.version;
const newVersion = bumpVersion(currentVersion, bumpType);

console.log(`Bumping ${bumpType}: ${currentVersion} → ${newVersion}`);

for (const target of targets) {
  const manifestPath = MANIFESTS[target];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  manifest.version = newVersion;
  if ('version_name' in manifest) manifest.version_name = newVersion;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Updated ${path.relative(root, manifestPath)}`);
}
