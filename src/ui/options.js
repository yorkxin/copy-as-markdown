import Settings from '../lib/settings.js';

const SelLinkTextAlwaysEscapeBrackets = '#form [name="link-text-always-escape-brackets"]';

function loadSettings() {
  Settings.getLinkTextAlwaysEscapeBrackets().then((value) => {
    document.querySelector(SelLinkTextAlwaysEscapeBrackets).checked = value;
  });

  Settings.getStyleOfUnorderedList().then((value) => {
    document.forms['form-style-of-unordered-list'].elements.character.value = value;
  });
}

document.addEventListener('DOMContentLoaded', loadSettings);

document.querySelector(SelLinkTextAlwaysEscapeBrackets)
  .addEventListener('change', (event) => {
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
