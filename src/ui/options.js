import OptionsManager from "../lib/options-manager.js";

let form = document.getElementById("form");

// Saves options to browser.storage.sync.
function save() {
  OptionsManager.save({
    escape: form.escape.checked
  })
}

// Restores select box and checkbox state using the preferences
// stored in browser.storage.
function load() {
  OptionsManager.load().then(items => {
    form.escape.checked = items.escape
  })
}

document.addEventListener('DOMContentLoaded', load);
document.getElementById('form').addEventListener('change', save);
