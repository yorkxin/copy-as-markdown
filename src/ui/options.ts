import type { TabGroupIndentationStyle, UnorderedListStyle } from '../lib/markdown.js';
import Settings from '../lib/settings.js';
import type { PermissionStatus } from './permissions-ui.js';
import { disableUiIfPermissionsNotGranted, hideUiIfPermissionsNotGranted, loadPermissions } from './permissions-ui.js';

function showFlash(message: string): void {
  const flash = document.getElementById('flash-error');
  if (!flash) return;
  flash.classList.remove('is-hidden');
  const p = flash.querySelector('p');
  if (p) p.textContent = message;
}

function hideFlash(): void {
  const flash = document.getElementById('flash-error');
  if (!flash) return;
  flash.classList.add('is-hidden');
  const p = flash.querySelector('p');
  if (p) p.textContent = '';
}

function disableTabGroupIndentation(permissionStatuses: PermissionStatus): void {
  disableUiIfPermissionsNotGranted(permissionStatuses);
}

async function loadSettings(): Promise<void> {
  try {
    const settings = await Settings.getAll();
    const formEscapeBrackets = document.forms.namedItem('form-link-text-always-escape-brackets');
    const formUnorderedList = document.forms.namedItem('form-style-of-unordered-list');
    const formTabGroupIndentation = document.forms.namedItem('form-style-of-tab-group-indentation');
    const formDecodeURLs = document.forms.namedItem('form-decode-urls');

    if (formEscapeBrackets) {
      const checkbox = formEscapeBrackets.elements.namedItem('enabled') as HTMLInputElement | null;
      if (checkbox) checkbox.checked = settings.alwaysEscapeLinkBrackets;
    }
    if (formUnorderedList) {
      const character = formUnorderedList.elements.namedItem('character') as RadioNodeList | null;
      if (character) character.value = settings.styleOfUnorderedList;
    }
    if (formTabGroupIndentation) {
      const indentation = formTabGroupIndentation.elements.namedItem('indentation') as RadioNodeList | null;
      if (indentation) indentation.value = settings.styleOfTabGroupIndentation;
    }
    if (formDecodeURLs) {
      const checkbox = formDecodeURLs.elements.namedItem('enabled') as HTMLInputElement | null;
      if (checkbox) checkbox.checked = settings.decodeURLs;
    }
    hideFlash();
  } catch (error) {
    console.error('error getting settings', error);
    showFlash('Failed to load settings. Please try again.');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  const statuses = await loadPermissions();
  hideUiIfPermissionsNotGranted(statuses);
  disableTabGroupIndentation(statuses);
});

const formEscapeBrackets = document.forms.namedItem('form-link-text-always-escape-brackets');
if (formEscapeBrackets) {
  formEscapeBrackets.addEventListener('change', async (event) => {
    try {
      const target = event.target as HTMLInputElement;
      await Settings.setLinkTextAlwaysEscapeBrackets(target.checked);
      hideFlash();
    } catch (error) {
      console.error('failed to save settings:', error);
      showFlash('Failed to save setting. Please try again.');
    }
  });
}

const formTabGroupIndentation = document.forms.namedItem('form-style-of-tab-group-indentation');
if (formTabGroupIndentation) {
  formTabGroupIndentation.addEventListener('change', async (event) => {
    try {
      const target = event.target as HTMLInputElement;
      await Settings.setStyleTabGroupIndentation(target.value as TabGroupIndentationStyle);
      hideFlash();
    } catch (error) {
      console.error('failed to save settings:', error);
      showFlash('Failed to save setting. Please try again.');
    }
  });
}

const formUnorderedList = document.forms.namedItem('form-style-of-unordered-list');
if (formUnorderedList) {
  formUnorderedList.addEventListener('change', async (event) => {
    try {
      const target = event.target as HTMLInputElement;
      await Settings.setStyleOfUnrderedList(target.value as UnorderedListStyle);
      hideFlash();
    } catch (error) {
      console.error('failed to save settings:', error);
      showFlash('Failed to save setting. Please try again.');
    }
  });
}

const formDecodeURLs = document.forms.namedItem('form-decode-urls');
if (formDecodeURLs) {
  formDecodeURLs.addEventListener('change', async (event) => {
    try {
      const target = event.target as HTMLInputElement;
      await Settings.setDecodeURLs(target.checked);
      hideFlash();
    } catch (error) {
      console.error('failed to save settings:', error);
      showFlash('Failed to save setting. Please try again.');
    }
  });
}

const resetButton = document.querySelector('#reset');
if (resetButton) {
  resetButton.addEventListener('click', async () => {
    try {
      await Settings.reset();
      await loadSettings();
      hideFlash();
    } catch (error) {
      console.error('failed to reset settings:', error);
      showFlash('Failed to reset settings. Please try again.');
    }
  });
}

browser.storage.sync.onChanged.addListener(async (changes) => {
  const hasSettingsChanged = Object.keys(changes).some(key => Settings.keys.includes(key));

  if (hasSettingsChanged) {
    await loadSettings();
  }
});
