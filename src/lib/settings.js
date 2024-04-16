const SKLinkTextAlwaysEscapeBrackets = 'linkTextAlwaysEscapeBrackets';
const SKStyleOfUnorderedList = 'styleOfUnorderedList ';

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
   * @return {Promise<void>}
   * */
  async setLinkTextAlwaysEscapeBrackets(value) {
    await chrome.storage.sync.set({
      [SKLinkTextAlwaysEscapeBrackets]: value,
    });
    this.publishUpdated();
  },

  async getStyleOfUnorderedList() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(SKStyleOfUnorderedList, (data) => {
        resolve(data[SKStyleOfUnorderedList] || 'dash');
      });
    });
  },

  async setStyleOfUnrderedList(value) {
    await chrome.storage.sync.set({
      [SKStyleOfUnorderedList]: value,
    });
    this.publishUpdated();
  },

  async reset() {
    await chrome.storage.sync.clear();
    this.publishUpdated();
  },

  publishUpdated() {
    // NOTE: Do not await, or it will block
    chrome.runtime.sendMessage({ topic: 'settings-updated' });
  },

  async getAll() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, (data) => {
        resolve(data);
      });
    });
  },
};
