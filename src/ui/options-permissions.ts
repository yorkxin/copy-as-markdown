import Settings from '../lib/settings';
import * as lib from './lib';
import type { PermissionStatus } from './lib';

let permissionStatuses: PermissionStatus = new Map();

async function loadPermissions(): Promise<void> {
  permissionStatuses = await lib.loadPermissions();
}

function refreshUi(): void {
  lib.hideUiIfPermissionsNotGranted(permissionStatuses);
  document.querySelectorAll<HTMLButtonElement>('[data-request-permission]').forEach((el) => {
    const permName = el.dataset.requestPermission;
    if (!permName) return;

    const status = permissionStatuses.get(permName);
    if (status === 'unavailable') {
      el.disabled = true;
      el.classList.remove('is-hidden', 'is-primary', 'is-outlined');
    } else if (status === 'yes') {
      el.disabled = true;
      el.classList.add('is-hidden');
    } else if (status === 'no') {
      el.disabled = false;
      el.classList.remove('is-hidden');
      el.classList.add('is-primary');
    }
  });

  document.querySelectorAll<HTMLButtonElement>('[data-remove-permission]').forEach((el) => {
    const permName = el.dataset.removePermission;
    if (!permName) return;

    const status = permissionStatuses.get(permName);
    if (status === 'unavailable') {
      el.disabled = true;
      el.classList.add('is-hidden');
      el.classList.remove('is-outlined');
    } else if (status === 'yes') {
      // permissions granted: show remove button
      el.disabled = false;
      el.classList.remove('is-hidden');
    } else if (status === 'no') {
      // permissions not all granted: hide remove button
      el.disabled = true;
      el.classList.add('is-hidden');
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadPermissions();
  refreshUi();
});

browser.permissions.onAdded.addListener(async () => {
  await loadPermissions();
  refreshUi();
});

browser.permissions.onRemoved.addListener(async () => {
  await loadPermissions();
  refreshUi();
});

document.querySelectorAll('[data-request-permission]').forEach((node) => {
  node.addEventListener('click', async (e) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const permName = target.dataset.requestPermission as browser._manifest.OptionalPermission | undefined;
    if (permName) {
      await browser.permissions.request({ permissions: [permName] });
    }
  });
});

document.querySelectorAll('[data-remove-permission]').forEach((node) => {
  node.addEventListener('click', async (e) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const permName = target.dataset.removePermission as browser._manifest.OptionalPermission | undefined;
    if (permName) {
      await browser.permissions.remove({ permissions: [permName] });
    }
  });
});

const revokeAllButton = document.querySelector('#revoke-all');
if (revokeAllButton) {
  revokeAllButton.addEventListener('click', async () => {
    await Settings.reset();
    const toBeRemoved = Array.from(permissionStatuses.entries())
      .filter(([, stat]) => stat !== 'unavailable')
      .map(([perm]) => perm) as browser._manifest.OptionalPermission[];
    await browser.permissions.remove({ permissions: toBeRemoved });
  });
}
