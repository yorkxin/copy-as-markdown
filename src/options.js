var DEFAULT_OPTIONS = {
  escape: false
};

// Saves options to chrome.storage.sync.
function save() {
  var form = document.getElementById("form")

  chrome.storage.sync.set({
    escape: form.escape.checked
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function load() {
  chrome.storage.sync.get(DEFAULT_OPTIONS, function(items) {
    var form = document.getElementById("form")
    form.escape.checked = items.escape;
  });
}

document.addEventListener('DOMContentLoaded', load);
document.getElementById('form').addEventListener('change', save);
