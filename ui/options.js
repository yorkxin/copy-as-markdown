import Options from "options";

// Saves options to chrome.storage.sync.
function save() {
  var form = document.getElementById("form")

  Options.save({
    escape: form.escape.checked
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function load() {
  Options.load(function(items) {
    var form = document.getElementById("form")
    form.escape.checked = items.escape;
  });
}

document.addEventListener('DOMContentLoaded', load);
document.getElementById('form').addEventListener('change', save);
