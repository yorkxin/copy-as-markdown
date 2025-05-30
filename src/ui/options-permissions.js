import Settings from '../lib/settings.js';
import * as lib from './lib.js';

/** @type {Map<string,"yes"|"no"|"unavailable">} */
let permissionStatuses = new Map();

async function loadPermissions() {
  permissionStatuses = await lib.loadPermissions();
}

function refreshUi() {
  lib.hideUiIfPermissionsNotGranted(permissionStatuses);
  document.querySelectorAll('[data-request-permission]').forEach((/** @type {HTMLButtonElement} */ el) => {
    const status = permissionStatuses.get(el.dataset.requestPermission);
    if (status === 'unavailable') {
      // eslint-disable-next-line no-param-reassign
      el.disabled = true;
      el.classList.remove('is-hidden', 'is-primary', 'is-outlined');
    } else if (status === 'yes') {
      // eslint-disable-next-line no-param-reassign
      el.disabled = true;
      el.classList.add('is-hidden');
    } else if (status === 'no') {
      // eslint-disable-next-line no-param-reassign
      el.disabled = false;
      el.classList.remove('is-hidden');
      el.classList.add('is-primary');
    }
  });

  document.querySelectorAll('[data-remove-permission]').forEach((/** @type {HTMLButtonElement} */ el) => {
    const status = permissionStatuses.get(el.dataset.removePermission);
    if (status === 'unavailable') {
      // eslint-disable-next-line no-param-reassign
      el.disabled = true;
      el.classList.add('is-hidden');
      el.classList.remove('is-outlined');
    } else if (status === 'yes') {
      // permissions granted: show remove button
      // eslint-disable-next-line no-param-reassign
      el.disabled = false;
      el.classList.remove('is-hidden');
    } else if (status === 'no') {
      // permissions not all granted: hide remove button
      // eslint-disable-next-line no-param-reassign
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
    await browser.permissions.request({ permissions: [e.target.dataset.requestPermission] });
  });
});

document.querySelectorAll('[data-remove-permission]').forEach((node) => {
  node.addEventListener('click', async (e) => {
    e.preventDefault();
    await browser.permissions.remove({ permissions: [e.target.dataset.removePermission] });
  });
});

document.querySelector('#revoke-all').addEventListener('click', async () => {
  await Settings.reset();
  const toBeRemoved = Array.from(permissionStatuses.entries())
    .filter(([, stat]) => stat !== 'unavailable')
    .map(([perm]) => perm);
  await browser.permissions.remove({ permissions: toBeRemoved });
});
