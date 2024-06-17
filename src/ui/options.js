import Settings from '../lib/settings.js';

function loadSettings() {
  Settings.getAll().then((settings) => {
    document.forms['form-link-text-always-escape-brackets'].elements.enabled
      .checked = settings.alwaysEscapeLinkBrackets;
    document.forms['form-style-of-unordered-list'].elements.character
      .value = settings.styleOfUnorderedList;
    document.forms['form-style-of-tab-group-indentation'].elements.indentation
      .value = settings.styleOfTabGroupIndentation;
  }).catch((error) => {
    console.error('error getting settings', error);
  });
}

/**
 *
 * @param name {String} name of the permission
 * @return {Promise<'granted'|'notGranted'|'unavailable'>}
 */
async function checkPermission(name) {
  try {
    // XXX: chrome.permissions in Firefox MV2 is broken.
    const entrypoint = (typeof browser !== 'undefined') ? browser.permissions : chrome.permissions;
    if (await entrypoint.contains({ permissions: [name] })) {
      return 'granted';
    }
    return 'notGranted';
  } catch (e) {
    // contains() throws an error when the name of the permission is not supported by this browser
    return 'unavailable';
  }
}

async function loadPermissions() {
  return Promise.all(['bookmarks'].map(async (permName) => {
    const elPermRequest = document.querySelector(`[data-permission-request=${permName}]`);
    const elPermRemove = document.querySelector(`[data-permission-remove=${permName}]`);
    const elPermStatus = document.querySelector(`[data-permission-status=${permName}]`);
    const status = await checkPermission(permName);
    switch (status) {
      case 'granted': {
        elPermRequest.classList.add('is-hidden');
        elPermRemove.classList.remove('is-hidden');
        elPermStatus.classList.add('is-primary');
        elPermStatus.innerText = 'Enabled';
        break;
      }
      case 'notGranted': {
        elPermRequest.classList.remove('is-hidden');
        elPermRemove.classList.add('is-hidden');
        elPermStatus.classList.remove('is-primary');
        elPermStatus.innerText = 'Disabled';
        break;
      }
      case 'unavailable': {
        elPermRequest.classList.add('is-hidden');
        elPermRemove.classList.add('is-hidden');
        elPermStatus.classList.remove('is-primary');
        elPermStatus.innerText = 'Unsupported';
        break;
      }
      default:
        console.error(`unknown checkPermission result: ${status}`);
    }
  }));
}

function hideUnsupportedFeatures() {
  if (typeof chrome.tabGroups === 'undefined') {
    document.forms['form-style-of-tab-group-indentation'].style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', loadSettings);
document.addEventListener('DOMContentLoaded', loadPermissions);
document.addEventListener('DOMContentLoaded', hideUnsupportedFeatures);

document.querySelectorAll('[data-permission-request]').forEach((node) => {
  node.addEventListener('click', async (e) => {
    e.preventDefault();
    // XXX: chrome.permissions in Firefox MV2 is broken.
    const entrypoint = (typeof browser !== 'undefined') ? browser.permissions : chrome.permissions;
    await entrypoint.request({ permissions: [node.dataset.permissionRequest] });
    await loadPermissions();
  });
});

document.querySelectorAll('[data-permission-remove]').forEach((node) => {
  node.addEventListener('click', async (e) => {
    e.preventDefault();
    // XXX: chrome.permissions in Firefox MV2 is broken.
    const entrypoint = (typeof browser !== 'undefined') ? browser.permissions : chrome.permissions;
    await entrypoint.remove({ permissions: [node.dataset.permissionRemove] });
    await loadPermissions();
  });
});

document.forms['form-link-text-always-escape-brackets'].addEventListener('change', (event) => {
  Settings.setLinkTextAlwaysEscapeBrackets(event.target.checked)
    .then(() => {
      console.info('settings saved');
    }, (error) => {
      console.error('failed to save settings:', error);
    });
});

document.forms['form-style-of-tab-group-indentation'].addEventListener('change', (event) => {
  Settings.setStyleTabGroupIndentation(event.target.value)
    .then(() => {
      console.info('settings saved');
    }, (error) => {
      console.error('failed to save settings:', error);
    });
});

document.forms['form-style-of-unordered-list'].addEventListener('change', (event) => {
  Settings.setStyleOfUnrderedList(event.target.value)
    .then(() => {
      console.info('settings saved');
    }, (error) => {
      console.error('failed to save settings:', error);
    });
});

document.querySelector('#reset').addEventListener('click', () => {
  const resettings = Settings.reset()
    .then(() => {
      console.info('settings cleared');
    }, (error) => {
      console.error('failed to save settings:', error);
    });

  resettings.then(loadSettings);
});
