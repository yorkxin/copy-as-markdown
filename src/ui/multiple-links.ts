import '../ensure-browser-global.js'; // MUST be first — installs `browser` for old Chrome.
import { isBulletListMarker, isTabGroupIndentationStyle } from '../lib/markdown.js';
import { ensureMarkdownSettingsMigrated, resetMultipleLinksSettings } from '../lib/markdown-settings.js';
import MultipleLinksSettings from '../lib/multiple-links-settings.js';
import { hideFlash, showFlash } from './flash.js';
import { disableUiIfPermissionsNotGranted, hideUiIfPermissionsNotGranted, loadPermissions } from './permissions-ui.js';

// The Multiple Links page. It owns the marker used by the built-in list
// exports — task lists keep their fixed `- [ ]` marker — and the indentation
// used when tabs are exported along with their tab groups.

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

/**
 * Put the controls back in sync with what is actually persisted after a write
 * fails, rather than merely undoing the click — another page may have changed
 * the same setting in the meantime.
 */
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
      // Only this context: Copy Selection, menu visibility, Advanced, and every
      // custom format are owned by their own pages and must survive this reset.
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

  // Migrate before the first read: this page may be the first one an upgrading
  // profile opens.
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
