import Settings from '../lib/settings.js';
import type { PermissionStatus } from './permissions-ui.js';
import { hideUiIfPermissionsNotGranted, loadPermissions, PermissionStatusValue } from './permissions-ui.js';

let permissionStatuses: PermissionStatus = new Map();

async function reloadPermissions(): Promise<void> {
  permissionStatuses = await loadPermissions();
}

function refreshUi(): void {
  hideUiIfPermissionsNotGranted(permissionStatuses);
  document.querySelectorAll<HTMLButtonElement>('[data-request-permission]').forEach((el) => {
    const permName = el.dataset.requestPermission;
    if (!permName) return;

    const status = permissionStatuses.get(permName);
    if (status === PermissionStatusValue.Unavailable) {
      el.disabled = true;
      el.classList.remove('is-hidden', 'is-primary', 'is-outlined');
    } else if (status === PermissionStatusValue.Yes) {
      el.disabled = true;
      el.classList.add('is-hidden');
    } else if (status === PermissionStatusValue.No) {
      el.disabled = false;
      el.classList.remove('is-hidden');
      el.classList.add('is-primary');
    }
  });

  document.querySelectorAll<HTMLButtonElement>('[data-remove-permission]').forEach((el) => {
    const permName = el.dataset.removePermission;
    if (!permName) return;

    const status = permissionStatuses.get(permName);
    if (status === PermissionStatusValue.Unavailable) {
      el.disabled = true;
      el.classList.add('is-hidden');
      el.classList.remove('is-outlined');
    } else if (status === PermissionStatusValue.Yes) {
      el.disabled = false;
      el.classList.remove('is-hidden');
    } else if (status === PermissionStatusValue.No) {
      el.disabled = true;
      el.classList.add('is-hidden');
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await reloadPermissions();
  refreshUi();
});

browser.permissions.onAdded.addListener(async () => {
  await reloadPermissions();
  refreshUi();
});

browser.permissions.onRemoved.addListener(async () => {
  await reloadPermissions();
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
      .filter(([, stat]) => stat !== PermissionStatusValue.Unavailable)
      .map(([perm]) => perm) as browser._manifest.OptionalPermission[];
    await browser.permissions.remove({ permissions: toBeRemoved });
  });
}
