import Settings from '../lib/settings.js';

function loadSettings() {
  Settings.getAll().then((settings) => {
    document.forms['form-link-text-always-escape-brackets'].elements.enabled
      .checked = settings.alwaysEscapeLinkBrackets;
    document.forms['form-style-of-unordered-list'].elements.character
      .value = settings.styleOfUnorderedList;
  }).catch((error) => {
    console.error('error getting settings', error);
  });
}

document.addEventListener('DOMContentLoaded', loadSettings);

document.forms['form-link-text-always-escape-brackets'].addEventListener('change', (event) => {
  Settings.setLinkTextAlwaysEscapeBrackets(event.target.checked)
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
