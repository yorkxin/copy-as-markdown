import * as OptionsManager from '../lib/options-manager.js';

const form = document.getElementById('form');

// Saves options to localStorage. String only.
function save() {
  OptionsManager.save({
    escape: form.escape.checked ? 'yes' : 'no',
  });
}

// Restores select box and checkbox state using the preferences
// stored in localStorage. String only.
function load() {
  OptionsManager.load().then((items) => {
    form.escape.checked = items.escape === 'yes';
  });
}

document.addEventListener('DOMContentLoaded', load);
document.getElementById('form').addEventListener('change', save);
