const SKLinkTextAlwaysEscapeBrackets = 'linkTextAlwaysEscapeBrackets';
const SKStyleOfUnorderedList = 'styleOfUnorderedList ';

/**
 * Singleton Settings object in the sync storage
 */
export default {
  /**
   * @param {boolean} value
   * @return {Promise<void>}
   * */
  async setLinkTextAlwaysEscapeBrackets(value) {
    await this.syncStorage.set({
      [SKLinkTextAlwaysEscapeBrackets]: value,
    });
    this.publishUpdated();
  },

  async setStyleOfUnrderedList(value) {
    await this.syncStorage.set({
      [SKStyleOfUnorderedList]: value,
    });
    this.publishUpdated();
  },

  async reset() {
    await this.syncStorage.clear();
    this.publishUpdated();
  },

  publishUpdated() {
    // NOTE: Do not await, or it will block
    chrome.runtime.sendMessage({ topic: 'settings-updated' });
  },

  async getAll() {
    const all = await this.syncStorage.get({
      [SKLinkTextAlwaysEscapeBrackets]: false,
      [SKStyleOfUnorderedList]: 'dash',
    });

    return {
      alwaysEscapeLinkBrackets: all[SKLinkTextAlwaysEscapeBrackets],
      styleOfUnorderedList: all[SKStyleOfUnorderedList],
    };
  },

  /**
   * @returns {chrome.storage.SyncStorageArea|browser.storage.StorageArea}
   */
  get syncStorage() {
    // XXX: in Firefox MV2 the implementation of chrome.storage.sync
    // always return undefined. We must use browser.storage.sync .
    if (typeof browser !== 'undefined') {
      return browser.storage.sync;
    }
    return chrome.storage.sync;
  },
};
