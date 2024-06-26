import '../vendor/browser-polyfill.js';

const SKLinkTextAlwaysEscapeBrackets = 'linkTextAlwaysEscapeBrackets';
const SKStyleOfUnorderedList = 'styleOfUnorderedList ';
const SKStyleTabGroupIndentation = 'style.tabgroup.indentation ';

/**
 * Singleton Settings object in the sync storage
 */
export default {
  /**
   * @param {boolean} value
   * @return {Promise<void>}
   * */
  async setLinkTextAlwaysEscapeBrackets(value) {
    await browser.storage.sync.set({
      [SKLinkTextAlwaysEscapeBrackets]: value,
    });
    await this.publishUpdated();
  },

  async setStyleTabGroupIndentation(value) {
    await browser.storage.sync.set({
      [SKStyleTabGroupIndentation]: value,
    });
    await this.publishUpdated();
  },

  async setStyleOfUnrderedList(value) {
    await browser.storage.sync.set({
      [SKStyleOfUnorderedList]: value,
    });
    await this.publishUpdated();
  },

  async reset() {
    await browser.storage.sync.clear();
    await this.publishUpdated();
  },

  async publishUpdated() {
    // NOTE: Do not await, or it will block
    await browser.runtime.sendMessage({ topic: 'settings-updated' });
  },

  async getAll() {
    const all = await browser.storage.sync.get({
      [SKLinkTextAlwaysEscapeBrackets]: false,
      [SKStyleOfUnorderedList]: 'dash',
      [SKStyleTabGroupIndentation]: 'spaces',
    });

    return {
      alwaysEscapeLinkBrackets: all[SKLinkTextAlwaysEscapeBrackets],
      styleOfUnorderedList: all[SKStyleOfUnorderedList],
      styleOfTabGroupIndentation: all[SKStyleTabGroupIndentation],
    };
  },
};
