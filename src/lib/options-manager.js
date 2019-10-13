let DEFAULT_OPTIONS = {
  escape: false
};

export default {
  save: async (params) => {
    return new Promise(resolve => {
      chrome.storage.sync.set(params, resolve);
    });
  },

  load: async () => {
    return new Promise(resolve => {
      chrome.storage.sync.get(result => {
        resolve(result || DEFAULT_OPTIONS)
      });
    });
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
