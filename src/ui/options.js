import Settings from '../lib/settings.js';

/** @type {Map<String,"yes"|"no"|"unavailable">} */
const permissionStatuses = new Map();

async function loadSettings() {
  try {
    const settings = await Settings.getAll();
    document.forms['form-link-text-always-escape-brackets'].elements.enabled
      .checked = settings.alwaysEscapeLinkBrackets;
    document.forms['form-style-of-unordered-list'].elements.character
      .value = settings.styleOfUnorderedList;
    document.forms['form-style-of-tab-group-indentation'].elements.indentation
      .value = settings.styleOfTabGroupIndentation;
  } catch (error) {
    console.error('error getting settings', error);
  }
}

async function loadPermissions() {
  /** @type {Map<String,"yes"|"no"|"unavailable">} */
  await Promise.all(['bookmarks', 'tabs', 'tabGroups'].map(async (perm) => {
    try {
      const status = await browser.permissions.contains({ permissions: [perm] });
      permissionStatuses.set(perm, status ? 'yes' : 'no');
    } catch (e) {
      permissionStatuses.set(perm, 'unavailable');
    }
  }));

  document.querySelectorAll('[data-request-permission]').forEach((el) => {
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

  document.querySelectorAll('[data-remove-permission]').forEach((el) => {
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

  document.querySelectorAll('[data-dependson-permissions]').forEach((el) => {
    const dependsOn = el.dataset.dependsonPermissions.split(',');
    const statuses = dependsOn.map((perm) => permissionStatuses.get(perm));
    // eslint-disable-next-line no-param-reassign
    el.disabled = !statuses.every((dep) => dep === 'yes');
  });
}

document.addEventListener('DOMContentLoaded', loadSettings);
document.addEventListener('DOMContentLoaded', loadPermissions);

browser.permissions.onAdded.addListener(loadPermissions);
browser.permissions.onRemoved.addListener(loadPermissions);

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

document.forms['form-link-text-always-escape-brackets'].addEventListener('change', async (event) => {
  try {
    await Settings.setLinkTextAlwaysEscapeBrackets(event.target.checked);
    console.info('settings saved');
  } catch (error) {
    console.error('failed to save settings:', error);
  }
});

document.forms['form-style-of-tab-group-indentation'].addEventListener('change', async (event) => {
  try {
    await Settings.setStyleTabGroupIndentation(event.target.value);
    console.info('settings saved');
  } catch (error) {
    console.error('failed to save settings:', error);
  }
});

document.forms['form-style-of-unordered-list'].addEventListener('change', async (event) => {
  try {
    await Settings.setStyleOfUnrderedList(event.target.value);
    console.info('settings saved');
  } catch (error) {
    console.error('failed to save settings:', error);
  }
});

document.querySelector('#reset').addEventListener('click', async () => {
  await Settings.reset();
  const toBeRemoved = Array.from(permissionStatuses.entries())
    .filter(([, stat]) => stat !== 'unavailable')
    .map(([perm]) => perm);
  await browser.permissions.remove({ permissions: toBeRemoved });
});

browser.storage.sync.onChanged.addListener(async (changes) => {
  const hasSettingsChanged = Object.entries(changes)
    .filter(([key]) => Settings.keys.includes(key))
    .length > 0;

  if (hasSettingsChanged) {
    await loadSettings();
  }
});
