#!/usr/bin/env node

/**
 * Build a test-specific Chrome extension with modified permissions and mock clipboard
 *
 * This script:
 * 1. Copies the chrome/ directory to chrome-test/
 * 2. Modifies manifest.json to move 'tabs' from optional to required permissions
 * 3. Used only for E2E testing with Playwright
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const sourceDir = path.join(rootDir, 'chrome');

const variants = [
  {
    name: 'default (permissions pre-granted)',
    targetDir: 'chrome-test',
    keepOptionalPermissions: false,
  },
  {
    name: 'optional permissions (request flows)',
    targetDir: 'chrome-optional-test',
    keepOptionalPermissions: true,
  },
];

console.log('Building test extensions...');

for (const variant of variants) {
  buildTestExtensionVariant(variant);
}

/**
 * Build a single test extension variant
 * @param {{ name: string; targetDir: string; keepOptionalPermissions: boolean }} config
 */
function buildTestExtensionVariant(config) {
  const variantTargetDir = path.join(rootDir, config.targetDir);
  console.log(`\n→ ${config.name}`);

  // Remove existing directory
  if (fs.existsSync(variantTargetDir)) {
    fs.rmSync(variantTargetDir, { recursive: true });
  }

  // Copy chrome directory to variant target
  console.log(`  Copying ${sourceDir} → ${variantTargetDir}`);
  fs.cpSync(sourceDir, variantTargetDir, { recursive: true });

  rewriteManifest(variantTargetDir, config.keepOptionalPermissions);

  console.log(`  ✓ Built ${config.targetDir}`);
}

function rewriteManifest(targetDirPath, keepOptionalPermissions) {
  console.log('  Modifying manifest.json');
  const manifestPath = path.join(targetDirPath, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  if (!Array.isArray(manifest.permissions)) {
    manifest.permissions = [];
  }
  if (!Array.isArray(manifest.optional_permissions)) {
    manifest.optional_permissions = [];
  }

  function moveToRequiredPermission(permission) {
    if (manifest.optional_permissions && manifest.optional_permissions.includes(permission)) {
      manifest.optional_permissions = manifest.optional_permissions.filter(p => p !== permission);

      if (!manifest.permissions.includes(permission)) {
        manifest.permissions.push(permission);
      }

      console.log(`    - Moved "${permission}" to permissions`);
    }
  }

  if (!keepOptionalPermissions) {
    moveToRequiredPermission('tabs');
    moveToRequiredPermission('tabGroups');
  } else {
    console.log('    - Keeping tabs/tabGroups optional for permission flow tests');
  }

  if (!manifest.host_permissions) {
    manifest.host_permissions = [];
  }

  if (!manifest.host_permissions.includes('http://localhost:5566/*')) {
    manifest.host_permissions.push('http://localhost:5566/*');
    console.log('    - Added host_permissions for http://localhost:5566/*');
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('    Required:', manifest.permissions.join(', '));
  console.log('    Optional:', manifest.optional_permissions?.join(', ') || 'None');
}
