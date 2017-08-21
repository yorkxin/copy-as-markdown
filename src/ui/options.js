import OptionsManager from "../lib/options-manager.js";

// Saves options to chrome.storage.sync.
function save() {
  let form = document.getElementById("form")

  OptionsManager.save({
    escape: form.escape.checked
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function load() {
  OptionsManager.load(function(items) {
    let form = document.getElementById("form")
    form.escape.checked = items.escape;
  });
}

document.addEventListener('DOMContentLoaded', load);
document.getElementById('form').addEventListener('change', save);
