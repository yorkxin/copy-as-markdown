let DEFAULT_OPTIONS = {
  escape: false
};

export default {
  save: (params) => {
    return browser.storage.sync.set(params);
  },

  load: () => {
    return browser.storage.sync.get(DEFAULT_OPTIONS)
  },

  onChange: (callback) => {
    browser.storage.onChanged.addListener(function(changes) {
      let callbackChanges = {};

      for (let key in DEFAULT_OPTIONS) {
        callbackChanges[key] = changes[key].newValue;
      }

      callback(callbackChanges);
    })
  }
};
