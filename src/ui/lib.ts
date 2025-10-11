export type PermissionStatus = Map<string, 'yes' | 'no' | 'unavailable'>;

/**
 * Loads the permissions statuses for the given permissions.
 */
export async function loadPermissions(): Promise<PermissionStatus> {
  const permissionStatuses: PermissionStatus = new Map();

  await Promise.all(['bookmarks', 'tabs', 'tabGroups'].map(async (perm) => {
    try {
      const status = await browser.permissions.contains({ permissions: [perm] });
      permissionStatuses.set(perm, status ? 'yes' : 'no');
    } catch (e) {
      permissionStatuses.set(perm, 'unavailable');
    }
  }));

  return permissionStatuses;
}

export function hideUiIfPermissionsNotGranted(permissionStatuses: PermissionStatus): void {
  document.querySelectorAll<HTMLElement>('[data-hide-if-permission-contains]').forEach((el) => {
    const permName = el.dataset.hideIfPermissionContains;
    if (!permName) return;

    const status = permissionStatuses.get(permName);
    if (status === 'unavailable') {
      el.innerText = 'Unsupported';
    } else if (status === 'yes') {
      el.classList.add('is-hidden');
    } else if (status === 'no') {
      el.classList.remove('is-hidden');
    }
  });
}

export function disableUiIfPermissionsNotGranted(permissionStatuses: PermissionStatus): void {
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('[data-dependson-permissions]').forEach((el) => {
    const dependsOnStr = el.dataset.dependsonPermissions;
    if (!dependsOnStr) return;

    const dependsOn = dependsOnStr.split(',');
    const statuses = dependsOn.map((perm) => permissionStatuses.get(perm));
    el.disabled = !statuses.every((dep) => dep === 'yes');
  });
}
