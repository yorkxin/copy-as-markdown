export enum PermissionStatusValue {
  Yes = 'yes',
  No = 'no',
  Unavailable = 'unavailable',
}

export type PermissionStatus = Map<string, PermissionStatusValue>;

/**
 * Loads the permissions statuses for the given permissions.
 */
export async function loadPermissions(): Promise<PermissionStatus> {
  const permissionStatuses: PermissionStatus = new Map();

  await Promise.all(['bookmarks', 'tabs', 'tabGroups'].map(async (perm) => {
    try {
      const granted = await browser.permissions.contains({ permissions: [perm] });
      permissionStatuses.set(perm, granted ? PermissionStatusValue.Yes : PermissionStatusValue.No);
    } catch {
      permissionStatuses.set(perm, PermissionStatusValue.Unavailable);
    }
  }));

  return permissionStatuses;
}

export function hideUiIfPermissionsNotGranted(permissionStatuses: PermissionStatus): void {
  document.querySelectorAll<HTMLElement>('[data-hide-if-permission-contains]').forEach((el) => {
    const permName = el.dataset.hideIfPermissionContains;
    if (!permName) return;

    const status = permissionStatuses.get(permName);
    if (status === PermissionStatusValue.Unavailable) {
      el.textContent = 'Unsupported';
    } else if (status === PermissionStatusValue.Yes) {
      el.classList.add('is-hidden');
    } else if (status === PermissionStatusValue.No) {
      el.classList.remove('is-hidden');
    }
  });
}

export function disableUiIfPermissionsNotGranted(permissionStatuses: PermissionStatus): void {
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('[data-dependson-permissions]').forEach((el) => {
    const dependsOnStr = el.dataset.dependsonPermissions;
    if (!dependsOnStr) return;

    const dependsOn = dependsOnStr.split(',');
    const statuses = dependsOn.map(perm => permissionStatuses.get(perm));
    el.disabled = !statuses.every(dep => dep === PermissionStatusValue.Yes);
  });
}
