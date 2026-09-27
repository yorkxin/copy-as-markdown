import '../ensure-browser-global.js'; // Installs `browser` before dependent modules evaluate.
import { isBulletListMarker } from '../lib/markdown.js';
import { ensureMarkdownSettingsMigrated, resetSelectionSettings } from '../lib/markdown-settings.js';
import SelectionSettings, { isCodeBlockStyle } from '../lib/selection-settings.js';
import { hideFlash, showFlash } from './flash.js';

// This page owns Copy Selection's bullet-list marker and code-block style.
const BulletListMarkerFormId = 'form-selection-bullet-list-marker';
const CodeBlockStyleFormId = 'form-selection-code-block-style';

function radioGroup(formId: string, name: string): RadioNodeList | null {
  const form = document.forms.namedItem(formId);
  if (!form) return null;
  return form.elements.namedItem(name) as RadioNodeList | null;
}

async function loadSettings(): Promise<void> {
  const { bulletListMarker, codeBlockStyle } = await SelectionSettings.getAll();

  const markers = radioGroup(BulletListMarkerFormId, 'bullet-list-marker');
  if (markers) markers.value = bulletListMarker;

  const codeBlockStyles = radioGroup(CodeBlockStyleFormId, 'code-block-style');
  if (codeBlockStyles) codeBlockStyles.value = codeBlockStyle;
}

/** After a failed write, storage is re-read to include concurrent changes from other pages. */
async function refresh(): Promise<void> {
  try {
    await loadSettings();
  } catch (error) {
    console.error('failed to reload Copy Selection settings after a failed write', error);
  }
}

function wireBulletListMarker(): void {
  const form = document.forms.namedItem(BulletListMarkerFormId);
  if (!form) return;

  form.addEventListener('change', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !isBulletListMarker(target.value)) return;

    try {
      await SelectionSettings.setBulletListMarker(target.value);
      hideFlash();
    } catch (error) {
      console.error('failed to save settings:', error);
      await refresh();
      showFlash('Failed to save setting. Please try again.');
    }
  });
}

function wireCodeBlockStyle(): void {
  const form = document.forms.namedItem(CodeBlockStyleFormId);
  if (!form) return;

  form.addEventListener('change', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !isCodeBlockStyle(target.value)) return;

    try {
      await SelectionSettings.setCodeBlockStyle(target.value);
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
      await resetSelectionSettings();
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
  wireCodeBlockStyle();
  wireReset();

  await ensureMarkdownSettingsMigrated();

  try {
    await loadSettings();
    hideFlash();
  } catch (error) {
    console.error('error getting settings', error);
    showFlash('Failed to load settings. Please try again.');
  }
});

browser.storage.sync.onChanged.addListener(async (changes) => {
  const hasSettingsChanged = Object.keys(changes).some(key => SelectionSettings.keys.includes(key));
  if (hasSettingsChanged) {
    await refresh();
  }
});
