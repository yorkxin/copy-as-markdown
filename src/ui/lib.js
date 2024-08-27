/** @typedef PermissionStatus {Map<String,"yes"|"no"|"unavailable">} */

/**
 * Loads the permissions statuses for the given permissions.
 * @returns {Promise<PermissionStatus>}
 */
export async function loadPermissions() {
  /** @type {PermissionStatus} */
  const permissionStatuses = new Map();

  /** @type {Map<String,"yes"|"no"|"unavailable">} */
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

/**
 *
 * @param {PermissionStatus} permissionStatuses
 */
export function hideUiIfPermissionsNotGranted(permissionStatuses) {
  document.querySelectorAll('[data-hide-if-permission-contains]').forEach((el) => {
    const status = permissionStatuses.get(el.dataset.hideIfPermissionContains);
    if (status === 'unavailable') {
      // eslint-disable-next-line no-param-reassign
      el.innerText = 'Unsupported';
    } else if (status === 'yes') {
      // eslint-disable-next-line no-param-reassign
      el.classList.add('is-hidden');
    } else if (status === 'no') {
      el.classList.remove('is-hidden');
    }
  });
}

/**
 *
 * @param {PermissionStatus} permissionStatuses
 */
export function disableUiIfPermissionsNotGranted(permissionStatuses) {
  document.querySelectorAll('[data-dependson-permissions]').forEach((el) => {
    const dependsOn = el.dataset.dependsonPermissions.split(',');
    const statuses = dependsOn.map((perm) => permissionStatuses.get(perm));
    // eslint-disable-next-line no-param-reassign
    el.disabled = !statuses.every((dep) => dep === 'yes');
  });
}
