import Settings from '../lib/settings.js';

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

document.addEventListener('DOMContentLoaded', loadSettings);

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
});

browser.storage.sync.onChanged.addListener(async (changes) => {
  const hasSettingsChanged = Object.entries(changes)
    .filter(([key]) => Settings.keys.includes(key))
    .length > 0;

  if (hasSettingsChanged) {
    await loadSettings();
  }
});
