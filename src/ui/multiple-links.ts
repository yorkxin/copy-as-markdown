import '../ensure-browser-global.js'; // Installs `browser` before dependent modules evaluate.
import { isBulletListMarker, isTabGroupIndentationStyle } from '../lib/markdown.js';
import { ensureMarkdownSettingsMigrated, resetMultipleLinksSettings } from '../lib/markdown-settings.js';
import MultipleLinksSettings from '../lib/multiple-links-settings.js';
import { hideFlash, showFlash } from './flash.js';
import { disableUiIfPermissionsNotGranted, hideUiIfPermissionsNotGranted, loadPermissions } from './permissions-ui.js';

// This page owns Multiple Links' bullet-list marker and tab-group indentation.
const BulletListMarkerFormId = 'form-multiple-links-bullet-list-marker';
const TabGroupIndentationFormId = 'form-multiple-links-tab-group-indentation';

function radioGroup(formId: string, name: string): RadioNodeList | null {
  const form = document.forms.namedItem(formId);
  if (!form) return null;
  return form.elements.namedItem(name) as RadioNodeList | null;
}

async function loadSettings(): Promise<void> {
  const { bulletListMarker, tabGroupIndentation } = await MultipleLinksSettings.getAll();

  const markers = radioGroup(BulletListMarkerFormId, 'bullet-list-marker');
  if (markers) markers.value = bulletListMarker;

  const indentations = radioGroup(TabGroupIndentationFormId, 'indentation');
  if (indentations) indentations.value = tabGroupIndentation;
}

/** After a failed write, storage is re-read to include concurrent changes from other pages. */
async function refresh(): Promise<void> {
  try {
    await loadSettings();
  } catch (error) {
    console.error('failed to reload Multiple Links settings after a failed write', error);
  }
}

function wireBulletListMarker(): void {
  const form = document.forms.namedItem(BulletListMarkerFormId);
  if (!form) return;

  form.addEventListener('change', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !isBulletListMarker(target.value)) return;

    try {
      await MultipleLinksSettings.setBulletListMarker(target.value);
      hideFlash();
    } catch (error) {
      console.error('failed to save settings:', error);
      await refresh();
      showFlash('Failed to save setting. Please try again.');
    }
  });
}

function wireTabGroupIndentation(): void {
  const form = document.forms.namedItem(TabGroupIndentationFormId);
  if (!form) return;

  form.addEventListener('change', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !isTabGroupIndentationStyle(target.value)) return;

    try {
      await MultipleLinksSettings.setTabGroupIndentation(target.value);
      hideFlash();
    } catch (error) {
      console.error('failed to save settings:', error);
      await refresh();
      showFlash('Failed to save setting. Please try again.');
    }
  });
}

function wireReset(): void {
  const resetButton = document.querySelector('#reset');
  if (!resetButton) return;

  resetButton.addEventListener('click', async () => {
    try {
      await resetMultipleLinksSettings();
      await loadSettings();
      hideFlash();
    } catch (error) {
      console.error('failed to reset settings:', error);
      await refresh();
      showFlash('Failed to reset settings. Please try again.');
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  wireBulletListMarker();
  wireTabGroupIndentation();
  wireReset();

  await ensureMarkdownSettingsMigrated();

  try {
    await loadSettings();
    hideFlash();
  } catch (error) {
    console.error('error getting settings', error);
    showFlash('Failed to load settings. Please try again.');
  }

  const statuses = await loadPermissions();
  hideUiIfPermissionsNotGranted(statuses);
  disableUiIfPermissionsNotGranted(statuses);
});

browser.storage.sync.onChanged.addListener(async (changes) => {
  const hasSettingsChanged = Object.keys(changes).some(key => MultipleLinksSettings.keys.includes(key));
  if (hasSettingsChanged) {
    await refresh();
  }
});
