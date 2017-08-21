let DEFAULT_OPTIONS = {
  escape: false
};

export default {
  save: (params) => {
    chrome.storage.sync.set(params);
  },

  load: (callback) => {
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

  onChange: (callback) => {
    chrome.storage.onChanged.addListener(function(changes) {
      let callbackChanges = {};

      for (let key in DEFAULT_OPTIONS) {
        callbackChanges[key] = changes[key].newValue;
      }

      callback(callbackChanges);
    })
  }
};
