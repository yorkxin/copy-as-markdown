import type { TabGroupIndentationStyle, UnorderedListStyle } from '../lib/markdown.js';
import Settings from '../lib/settings.js';
import * as lib from './lib.js';

interface FormElements extends HTMLFormControlsCollection {
  enabled: HTMLInputElement;
  character: HTMLInputElement;
  indentation: HTMLInputElement;
}

interface SettingsForm extends HTMLFormElement {
  elements: FormElements;
}

async function loadSettings(): Promise<void> {
  try {
    const settings = await Settings.getAll();
    const formEscapeBrackets = document.forms.namedItem('form-link-text-always-escape-brackets') as SettingsForm | null;
    const formUnorderedList = document.forms.namedItem('form-style-of-unordered-list') as SettingsForm | null;
    const formTabGroupIndentation = document.forms.namedItem('form-style-of-tab-group-indentation') as SettingsForm | null;

    if (formEscapeBrackets) {
      formEscapeBrackets.elements.enabled.checked = settings.alwaysEscapeLinkBrackets;
    }
    if (formUnorderedList) {
      formUnorderedList.elements.character.value = settings.styleOfUnorderedList;
    }
    if (formTabGroupIndentation) {
      formTabGroupIndentation.elements.indentation.value = settings.styleOfTabGroupIndentation;
    }
  } catch (error) {
    console.error('error getting settings', error);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  const statuses = await lib.loadPermissions();
  lib.disableUiIfPermissionsNotGranted(statuses);
});

const formEscapeBrackets = document.forms.namedItem('form-link-text-always-escape-brackets');
if (formEscapeBrackets) {
  formEscapeBrackets.addEventListener('change', async (event) => {
    try {
      const target = event.target as HTMLInputElement;
      await Settings.setLinkTextAlwaysEscapeBrackets(target.checked);
      console.info('settings saved');
    } catch (error) {
      console.error('failed to save settings:', error);
    }
  });
}

const formTabGroupIndentation = document.forms.namedItem('form-style-of-tab-group-indentation');
if (formTabGroupIndentation) {
  formTabGroupIndentation.addEventListener('change', async (event) => {
    try {
      const target = event.target as HTMLInputElement;
      await Settings.setStyleTabGroupIndentation(target.value as TabGroupIndentationStyle);
      console.info('settings saved');
    } catch (error) {
      console.error('failed to save settings:', error);
    }
  });
}

const formUnorderedList = document.forms.namedItem('form-style-of-unordered-list');
if (formUnorderedList) {
  formUnorderedList.addEventListener('change', async (event) => {
    try {
      const target = event.target as HTMLInputElement;
      await Settings.setStyleOfUnrderedList(target.value as UnorderedListStyle);
      console.info('settings saved');
    } catch (error) {
      console.error('failed to save settings:', error);
    }
  });
}

const resetButton = document.querySelector('#reset');
if (resetButton) {
  resetButton.addEventListener('click', async () => {
    await Settings.reset();
  });
}

browser.storage.sync.onChanged.addListener(async (changes) => {
  const hasSettingsChanged = Object.entries(changes)
    .filter(([key]) => Settings.keys.includes(key))
    .length > 0;

  if (hasSettingsChanged) {
    await loadSettings();
  }
});
