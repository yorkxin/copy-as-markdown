#!/usr/bin/env node

/**
 * Build a test-specific Chrome extension with modified permissions and mock clipboard
 *
 * This script:
 * 1. Copies the chrome/ directory to chrome-test/
 * 2. Injects MOCK_CLIPBOARD flag into background.js to enable clipboard mocking
 * 3. Modifies manifest.json to move 'tabs' from optional to required permissions
 * 4. Used only for E2E testing with Playwright
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const sourceDir = path.join(rootDir, 'chrome');
const targetDir = path.join(rootDir, 'chrome-test');

console.log('Building test extension...');

// Remove existing test directory
if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true });
}

// Copy chrome directory to chrome-test
console.log(`Copying ${sourceDir} to ${targetDir}...`);
fs.cpSync(sourceDir, targetDir, { recursive: true });

// Inject MOCK_CLIPBOARD flag into background.js
console.log('Injecting MOCK_CLIPBOARD flag into background.js...');
const backgroundPath = path.join(targetDir, 'dist', 'background.js');

if (fs.existsSync(backgroundPath)) {
  let backgroundContent = fs.readFileSync(backgroundPath, 'utf8');

  // Inject the MOCK_CLIPBOARD flag at the top of the file
  backgroundContent = `globalThis.MOCK_CLIPBOARD = true;\n\n${backgroundContent}`;

  fs.writeFileSync(backgroundPath, backgroundContent, 'utf8');
  console.log('  - Injected MOCK_CLIPBOARD = true into background.js');
} else {
  console.error('  ⚠ Warning: background.js not found - did you run compile-chrome?');
}

// Read and modify manifest.json
const manifestPath = path.join(targetDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

console.log('Modifying manifest.json for testing...');

/**
 * Move a permission from optional_permissions to required permissions
 * @param {string} permission - The permission name to move
 */
function moveToRequiredPermission(permission) {
  if (manifest.optional_permissions && manifest.optional_permissions.includes(permission)) {
    manifest.optional_permissions = manifest.optional_permissions.filter(p => p !== permission);

    if (!manifest.permissions.includes(permission)) {
      manifest.permissions.push(permission);
    }

    console.log(`  - Moved "${permission}" from optional_permissions to permissions`);
  }
}

// Move 'tabs' and 'tabGroups' from optional_permissions to permissions for testing
moveToRequiredPermission('tabs');
moveToRequiredPermission('tabGroups');

// Add host_permissions for test fixtures (localhost)
if (!manifest.host_permissions) {
  manifest.host_permissions = [];
}

if (!manifest.host_permissions.includes('http://localhost:5566/*')) {
  manifest.host_permissions.push('http://localhost:5566/*');
  console.log('  - Added host_permissions for http://localhost:5566/*');
}

// Write modified manifest
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log('✓ Test extension built successfully at:', targetDir);
console.log('\nPermissions:');
console.log('  Required:', manifest.permissions.join(', '));
console.log('  Optional:', manifest.optional_permissions.join(', '));
