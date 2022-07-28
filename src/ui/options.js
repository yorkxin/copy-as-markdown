import Settings from '../lib/settings.js';

const SelLinkTextAlwaysEscapeBrackets = '#form [name="link-text-always-escape-brackets"]';

function loadSettings() {
  Settings.getLinkTextAlwaysEscapeBrackets().then((value) => {
    document.querySelector(SelLinkTextAlwaysEscapeBrackets).checked = value;
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

document.querySelector('#reset').addEventListener('click', () => {
  const resettings = Settings.reset()
    .then(() => {
      console.info('settings cleared');
    }, (error) => {
      console.error('failed to save settings:', error);
    });

  resettings.then(loadSettings);
});
