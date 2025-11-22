import { html, render } from '../vendor/uhtml.js';
import Settings from '../lib/settings.js';
import * as lib from './lib.js';
import type { PermissionStatus } from './lib.js';
import { PermissionStatusValue } from './lib.js';
import { menuView } from './menu.js';

type PermissionName = 'tabs' | 'tabGroups' | 'bookmarks';

interface PermissionsState {
  ready: boolean;
  flashMessage: string;
  permissions: PermissionStatus;
}

const root = document.getElementById('options-permissions-root') ?? document.body;

let state: PermissionsState = {
  ready: false,
  flashMessage: '',
  permissions: new Map(),
};

function setState(next: Partial<PermissionsState>): void {
  state = { ...state, ...next };
  render(root, view(state));
}

function view(s: PermissionsState) {
  const disableAll = !s.ready;
  const statusTag = (perm: PermissionName) => {
    const status = s.permissions.get(perm);
    if (status === PermissionStatusValue.Yes) return null;
    if (status === PermissionStatusValue.Unavailable) return html`<span class="tag">Unsupported</span>`;
    return html`<span class="tag">Not Granted</span>`;
  };

  const requestButton = (perm: PermissionName, label: string) => {
    const status = s.permissions.get(perm);
    const unavailable = status === PermissionStatusValue.Unavailable;
    const granted = status === PermissionStatusValue.Yes;
    return html`
      <button
        class=${`button is-small is-outlined ${granted ? 'is-hidden' : 'is-primary'}`}
        data-request-permission=${perm}
        disabled=${disableAll || unavailable || granted}
        onclick=${() => onRequestPermission(perm)}
      >
        ${label}
      </button>
    `;
  };

  const revokeButton = (perm: PermissionName, label: string) => {
    const status = s.permissions.get(perm);
    const unavailable = status === PermissionStatusValue.Unavailable;
    const granted = status === PermissionStatusValue.Yes;
    return html`
      <button
        class=${`button is-small is-outlined is-danger ${granted ? '' : 'is-hidden'}`}
        data-remove-permission=${perm}
        disabled=${disableAll || unavailable || !granted}
        onclick=${() => onRemovePermission(perm)}
      >
        ${label}
      </button>
    `;
  };

  return html`
  <div class="container section is-max-desktop">
    <h1 class="title">Copy as Markdown - Additional Permissions</h1>
    ${s.flashMessage
      ? html`<div class="notification is-danger">
          <button class="delete" aria-label="Close notification" onclick=${() => setState({ flashMessage: '' })}></button>
          ${s.flashMessage}
        </div>`
      : null}
    <div class="columns">
      <div class="column is-narrow" id="menu">
        ${menuView(window.location)}
      </div>
      <div class="column">
        <div class="box content" id="permissions">
          <h2 class="title is-3">Additional Permissions</h2>
          <p>Some features require additional permissions. Prompts will appear when permissions are not granted.</p>
          <h3>Tabs ${statusTag('tabs')}</h3>
          <p>Copy all / selected tabs via the popup menu and shortcut keys. Also, via context menus on tabs (Firefox-only).</p>
          <div class="field">
            ${requestButton('tabs', 'Grant Tabs Permission')}
            ${revokeButton('tabs', 'Revoke Tabs Permission')}
          </div>

          <h4>Tab Groups ${statusTag('tabGroups')}</h4>
          <p>Wrap tabs in your tab groups. Need to grant Tabs permission above.</p>
          <div class="field">
            ${requestButton('tabGroups', 'Grant Tab Groups Permission')}
            ${revokeButton('tabGroups', 'Revoke Tab Groups Permission')}
          </div>

          <h3>Bookmarks ${statusTag('bookmarks')}</h3>
          <p>Enable context menus on bookmarks (Firefox-only).</p>
          <div class="field">
            ${requestButton('bookmarks', 'Grant Bookmarks Permission')}
            ${revokeButton('bookmarks', 'Revoke Bookmarks Permission')}
          </div>
        </div>

        <button
          id="revoke-all"
          type="button"
          class="button is-outlined is-danger"
          disabled=${disableAll}
          onclick=${onRevokeAll}
        >
          Revoke All
        </button>
      </div>
    </div>
  </div>
  `;
}

async function onRequestPermission(permName: PermissionName): Promise<void> {
  if (!state.ready) return;
  try {
    await browser.permissions.request({ permissions: [permName] });
  } catch (error) {
    console.error('failed to request permission', error);
    setState({ flashMessage: 'Failed to request permission. Please try again.' });
  }
}

async function onRemovePermission(permName: PermissionName): Promise<void> {
  if (!state.ready) return;
  try {
    await browser.permissions.remove({ permissions: [permName] });
  } catch (error) {
    console.error('failed to remove permission', error);
    setState({ flashMessage: 'Failed to revoke permission. Please try again.' });
  }
}

async function onRevokeAll(): Promise<void> {
  if (!state.ready) return;
  try {
    await Settings.reset();
    const toBeRemoved = Array.from(state.permissions.entries())
      .filter(([, stat]) => stat !== PermissionStatusValue.Unavailable)
      .map(([perm]) => perm) as browser._manifest.OptionalPermission[];
    await browser.permissions.remove({ permissions: toBeRemoved });
  } catch (error) {
    console.error('failed to revoke all permissions', error);
    setState({ flashMessage: 'Failed to revoke permissions. Please try again.' });
  }
}

async function loadPermissions(): Promise<void> {
  setState({ ready: false });
  const permissionStatuses = await lib.loadPermissions();
  setState({ permissions: permissionStatuses, ready: true, flashMessage: '' });
}

browser.permissions.onAdded.addListener(async () => {
  await loadPermissions();
});

browser.permissions.onRemoved.addListener(async () => {
  await loadPermissions();
});

document.addEventListener('DOMContentLoaded', async () => {
  render(root, view(state));
  try {
    await loadPermissions();
  } catch (error) {
    console.error('failed to load permissions', error);
    setState({ flashMessage: 'Failed to load permissions. Please reopen the page.' });
  }
});
