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

const builds = [
  {
    sourceDir: path.join(rootDir, 'chrome'),
    variants: [
      {
        name: 'Chrome default (permissions pre-granted)',
        targetDir: 'chrome-test',
        keepOptionalPermissions: false,
        hostPermissions: ['http://localhost:5566/*'],
      },
      {
        name: 'Chrome optional permissions (request flows)',
        targetDir: 'chrome-optional-test',
        keepOptionalPermissions: true,
        hostPermissions: ['http://localhost:5566/*'],
      },
    ],
  },
  {
    sourceDir: path.join(rootDir, 'firefox'),
    variants: [
      {
        name: 'Firefox default (permissions pre-granted)',
        targetDir: 'firefox-test',
        keepOptionalPermissions: false,
      },
    ],
  },
];

console.log('Building test extensions...');

for (const buildConfig of builds) {
  for (const variant of buildConfig.variants) {
    buildTestExtensionVariant(buildConfig.sourceDir, variant);
  }
}

/**
 * Build a single test extension variant
 * @param {string} sourceDir
 * @param {{ name: string; targetDir: string; keepOptionalPermissions: boolean; hostPermissions?: string[] }} config
 */
function buildTestExtensionVariant(sourceDir, config) {
  const variantTargetDir = path.join(rootDir, config.targetDir);
  console.log(`\n→ ${config.name}`);

  // Remove existing directory
  if (fs.existsSync(variantTargetDir)) {
    fs.rmSync(variantTargetDir, { recursive: true });
  }

  // Copy chrome directory to variant target
  console.log(`  Copying ${sourceDir} → ${variantTargetDir}`);
  fs.cpSync(sourceDir, variantTargetDir, { recursive: true });

  rewriteManifest(variantTargetDir, {
    keepOptionalPermissions: config.keepOptionalPermissions,
    hostPermissions: config.hostPermissions ?? [],
  });

  console.log(`  ✓ Built ${config.targetDir}`);
}

function rewriteManifest(targetDirPath, options) {
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

  if (!options.keepOptionalPermissions) {
    moveToRequiredPermission('tabs');
    moveToRequiredPermission('tabGroups');
  } else {
    console.log('    - Keeping tabs/tabGroups optional for permission flow tests');
  }

  if (options.hostPermissions.length > 0) {
    if (!manifest.host_permissions) {
      manifest.host_permissions = [];
    }
    for (const hostPermission of options.hostPermissions) {
      if (!manifest.host_permissions.includes(hostPermission)) {
        manifest.host_permissions.push(hostPermission);
        console.log(`    - Added host_permissions for ${hostPermission}`);
      }
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('    Required:', manifest.permissions.join(', '));
  console.log('    Optional:', manifest.optional_permissions?.join(', ') || 'None');
}
