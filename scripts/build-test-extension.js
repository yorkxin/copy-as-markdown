#!/usr/bin/env node

/**
 * Build the e2e test extensions (chrome-test, chrome-optional-test, firefox-test).
 *
 * Each variant is compiled DIRECTLY with BUILD_PROFILE='e2e' (so the clipboard mock + E2E
 * hooks are present) and gets a manifest derived from the tracked source platform manifest
 * with permissions rewritten for testing. Nothing is copied from the production chrome/ or
 * firefox-mv3/ output (which is mock-free).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExtension } from './lib/build-extension.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const builds = [
  {
    platform: 'chrome',
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
    platform: 'firefox-mv3',
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
    await buildTestExtensionVariant(buildConfig.platform, variant);
  }
}

/**
 * @param {'chrome'|'firefox-mv3'} platform
 * @param {{ name: string; targetDir: string; keepOptionalPermissions: boolean; hostPermissions?: string[] }} config
 */
async function buildTestExtensionVariant(platform, config) {
  const variantTargetDir = path.join(rootDir, config.targetDir);
  console.log(`\n→ ${config.name}`);

  // Clean the whole variant dir, then compile directly into it with the e2e profile.
  if (fs.existsSync(variantTargetDir)) {
    fs.rmSync(variantTargetDir, { recursive: true });
  }

  console.log(`  Compiling ${platform} → ${config.targetDir}/dist (profile: e2e)`);
  await buildExtension({
    target: platform,
    outdir: path.join(variantTargetDir, 'dist'),
    profile: 'e2e',
  });

  // Derive the variant manifest from the tracked source platform manifest.
  const sourceManifestPath = path.join(rootDir, platform, 'manifest.json');
  const targetManifestPath = path.join(variantTargetDir, 'manifest.json');
  rewriteManifest(sourceManifestPath, targetManifestPath, {
    keepOptionalPermissions: config.keepOptionalPermissions,
    hostPermissions: config.hostPermissions ?? [],
  });

  console.log(`  ✓ Built ${config.targetDir}`);
}

function rewriteManifest(sourceManifestPath, targetManifestPath, options) {
  console.log('  Writing manifest.json');
  const manifest = JSON.parse(fs.readFileSync(sourceManifestPath, 'utf8'));

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

  function addRequiredPermission(permission) {
    if (!manifest.permissions.includes(permission)) {
      manifest.permissions.push(permission);
      console.log(`    - Added "${permission}" to permissions`);
    }

    if (manifest.optional_permissions.includes(permission)) {
      manifest.optional_permissions = manifest.optional_permissions.filter(p => p !== permission);
    }
  }

  if (!options.keepOptionalPermissions) {
    moveToRequiredPermission('tabs');
    moveToRequiredPermission('tabGroups');
  } else {
    console.log('    - Keeping tabs/tabGroups optional for permission flow tests');
  }

  addRequiredPermission('bookmarks');

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

  fs.writeFileSync(targetManifestPath, JSON.stringify(manifest, null, 2));

  console.log('    Required:', manifest.permissions.join(', '));
  console.log('    Optional:', manifest.optional_permissions?.join(', ') || 'None');
}
