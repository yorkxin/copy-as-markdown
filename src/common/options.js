var DEFAULT_OPTIONS = {
  escape: false
};

var Options = {
  save: function (params) {
    chrome.storage.sync.set(params);
  },

  load: function (callback) {
    // XXX: Chrome vs Firefox incompatibilty
    let syncStorage = chrome.storage.sync;
    if (syncStorage.get.length === 1) {
      // Firefox, Promise
      syncStorage.get(DEFAULT_OPTIONS).then(callback);
    } else if (syncStorage.get.length === 2) {
      // Chrome, callback
      syncStorage.get(DEFAULT_OPTIONS, callback);
    }
  },

  onChange: function(callback) {
    chrome.storage.onChanged.addListener(function(changes) {
      let callbackChanges = {};

      for (let key in DEFAULT_OPTIONS) {
        callbackChanges[key] = changes[key].newValue;
      }

      callback(callbackChanges);
    })

  }
};

export default Options;
