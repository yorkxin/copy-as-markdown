import '../ensure-browser-global.js'; // Installs `browser` before dependent modules evaluate.
import { isBulletListMarker } from '../lib/markdown.js';
import { ensureMarkdownSettingsMigrated, resetSelectionSettings } from '../lib/markdown-settings.js';
import SelectionSettings, { isCodeBlockStyle, isEmDelimiter, isStrongDelimiter } from '../lib/selection-settings.js';
import { hideFlash, showFlash } from './flash.js';

// This page owns Copy Selection's Markdown formatting settings.
const BulletListMarkerFormId = 'form-selection-bullet-list-marker';
const CodeBlockStyleFormId = 'form-selection-code-block-style';
const EmDelimiterFormId = 'form-selection-em-delimiter';
const StrongDelimiterFormId = 'form-selection-strong-delimiter';

function radioGroup(formId: string, name: string): RadioNodeList | null {
  const form = document.forms.namedItem(formId);
  if (!form) return null;
  return form.elements.namedItem(name) as RadioNodeList | null;
}

async function loadSettings(): Promise<void> {
  const { bulletListMarker, codeBlockStyle, emDelimiter, strongDelimiter } = await SelectionSettings.getAll();

  const markers = radioGroup(BulletListMarkerFormId, 'bullet-list-marker');
  if (markers) markers.value = bulletListMarker;

  const codeBlockStyles = radioGroup(CodeBlockStyleFormId, 'code-block-style');
  if (codeBlockStyles) codeBlockStyles.value = codeBlockStyle;

  const emphasis = radioGroup(EmDelimiterFormId, 'em-delimiter');
  if (emphasis) emphasis.value = emDelimiter;

  const strong = radioGroup(StrongDelimiterFormId, 'strong-delimiter');
  if (strong) strong.value = strongDelimiter;
}

/** After a failed write, storage is re-read to include concurrent changes from other pages. */
async function refresh(): Promise<void> {
  try {
    await loadSettings();
  } catch (error) {
    console.error('failed to reload Copy Selection settings after a failed write', error);
  }
}

function wireSetting<T extends string>(
  formId: string,
  isValid: (value: unknown) => value is T,
  save: (value: T) => Promise<void>,
): void {
  const form = document.forms.namedItem(formId);
  if (!form) return;

  form.addEventListener('change', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !isValid(target.value)) return;

    try {
      await save(target.value);
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
  wireSetting(BulletListMarkerFormId, isBulletListMarker, SelectionSettings.setBulletListMarker);
  wireSetting(CodeBlockStyleFormId, isCodeBlockStyle, SelectionSettings.setCodeBlockStyle);
  wireSetting(EmDelimiterFormId, isEmDelimiter, SelectionSettings.setEmDelimiter);
  wireSetting(StrongDelimiterFormId, isStrongDelimiter, SelectionSettings.setStrongDelimiter);
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
