import '../ensure-browser-global.js'; // MUST be first — installs `browser` for old Chrome.
import type { BulletListMarker, TabGroupIndentationStyle } from '../lib/markdown.js';
import type { MarkdownSettings } from '../lib/markdown-settings.js';
import {
  loadMarkdownSettings,
  markdownSettingsKeys,
  readMarkdownSettings,
  resetMarkdownSettings,
  setSharedBulletListMarker,
} from '../lib/markdown-settings.js';
import MultipleLinksSettings from '../lib/multiple-links-settings.js';
import type { CodeBlockStyle } from '../lib/selection-settings.js';
import SelectionSettings from '../lib/selection-settings.js';
import Settings from '../lib/settings.js';
import type { PermissionStatus } from './permissions-ui.js';
import { disableUiIfPermissionsNotGranted, hideUiIfPermissionsNotGranted, loadPermissions } from './permissions-ui.js';

// This transitional page still presents one Unordered List Character control for
// both Copy Selection and Multiple Links, so it reads one and writes both in a
// single storage write. The dedicated per-context pages replace it later.
const MarkerOfRadioValue: Record<string, BulletListMarker> = {
  dash: '-',
  asterisk: '*',
  plus: '+',
};

const RadioValueOfMarker = Object.fromEntries(
  Object.entries(MarkerOfRadioValue).map(([radioValue, marker]) => [marker, radioValue]),
) as Record<BulletListMarker, string>;

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

async function loadSettings(read: () => Promise<MarkdownSettings> = readMarkdownSettings): Promise<void> {
  try {
    const { alwaysEscapeLinkBrackets, selection, multipleLinks } = await read();
    const formEscapeBrackets = document.forms.namedItem('form-link-text-always-escape-brackets');
    const formUnorderedList = document.forms.namedItem('form-style-of-unordered-list');
    const formCodeBlockStyle = document.forms.namedItem('form-style-of-code-block');
    const formTabGroupIndentation = document.forms.namedItem('form-style-of-tab-group-indentation');

    if (formEscapeBrackets) {
      const checkbox = formEscapeBrackets.elements.namedItem('enabled') as HTMLInputElement | null;
      if (checkbox) checkbox.checked = alwaysEscapeLinkBrackets;
    }
    if (formUnorderedList) {
      const character = formUnorderedList.elements.namedItem('character') as RadioNodeList | null;
      if (character) character.value = RadioValueOfMarker[selection.bulletListMarker];
    }
    if (formCodeBlockStyle) {
      const codeBlockStyle = formCodeBlockStyle.elements.namedItem('code-block-style') as RadioNodeList | null;
      if (codeBlockStyle) codeBlockStyle.value = selection.codeBlockStyle;
    }
    if (formTabGroupIndentation) {
      const indentation = formTabGroupIndentation.elements.namedItem('indentation') as RadioNodeList | null;
      if (indentation) indentation.value = multipleLinks.tabGroupIndentation;
    }
    hideFlash();
  } catch (error) {
    console.error('error getting settings', error);
    showFlash('Failed to load settings. Please try again.');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Migrate before the first read so an upgrading profile never sees this page
  // fall back to defaults. Idempotent, so racing the background copy is safe.
  await loadSettings(loadMarkdownSettings);
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
      await MultipleLinksSettings.setTabGroupIndentation(target.value as TabGroupIndentationStyle);
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
      const marker = MarkerOfRadioValue[target.value];
      if (!marker) return;
      await setSharedBulletListMarker(marker);
      hideFlash();
    } catch (error) {
      console.error('failed to save settings:', error);
      showFlash('Failed to save setting. Please try again.');
    }
  });
}

const formCodeBlockStyle = document.forms.namedItem('form-style-of-code-block');
if (formCodeBlockStyle) {
  formCodeBlockStyle.addEventListener('change', async (event) => {
    try {
      const target = event.target as HTMLInputElement;
      await SelectionSettings.setCodeBlockStyle(target.value as CodeBlockStyle);
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
      await resetMarkdownSettings();
      await loadSettings();
      hideFlash();
    } catch (error) {
      console.error('failed to reset settings:', error);
      showFlash('Failed to reset settings. Please try again.');
    }
  });
}

browser.storage.sync.onChanged.addListener(async (changes) => {
  const hasSettingsChanged = Object.keys(changes).some(key => markdownSettingsKeys.includes(key));

  if (hasSettingsChanged) {
    await loadSettings();
  }
});
