const SKLinkTextAlwaysEscapeBrackets = 'linkTextAlwaysEscapeBrackets';

/**
 * Singleton Settings object in the chrome.storage.sync storage
 */
export default {
  /** @return {Promise<boolean>} */
  async getLinkTextAlwaysEscapeBrackets() {
    // XXX: for some reason `await chrome.StorageArea.get()` does not work in
    // Firefox MV3 (version 102) so wrap in a Promise.
    return new Promise((resolve) => {
      chrome.storage.sync.get(SKLinkTextAlwaysEscapeBrackets, (data) => {
        resolve(data[SKLinkTextAlwaysEscapeBrackets] || false);
      });
    });
  },

  /**
   * @param {boolean} value
   * @return {Promise<boolean>}
   * */
  async setLinkTextAlwaysEscapeBrackets(value) {
    return chrome.storage.sync.set({
      [SKLinkTextAlwaysEscapeBrackets]: value,
    });
  },

  async reset() {
    return chrome.storage.sync.clear();
  },

  async getAll() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, (data) => {
        resolve(data);
      });
    });
  },
};
