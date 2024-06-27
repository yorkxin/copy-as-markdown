import '../vendor/browser-polyfill.js';

const SKLinkTextAlwaysEscapeBrackets = 'linkTextAlwaysEscapeBrackets';
const SKStyleOfUnorderedList = 'styleOfUnorderedList ';
const SKStyleTabGroupIndentation = 'style.tabgroup.indentation ';

/**
 * Singleton Settings object in the sync storage
 */
export default {
  SKLinkTextAlwaysEscapeBrackets,
  SKStyleOfUnorderedList,
  SKStyleTabGroupIndentation,

  get defaultSettings() {
    return {
      [SKLinkTextAlwaysEscapeBrackets]: false,
      [SKStyleOfUnorderedList]: 'dash',
      [SKStyleTabGroupIndentation]: 'spaces',
    };
  },

  get keys() {
    return Object.keys(this.defaultSettings);
  },

  /**
   * @param {boolean} value
   * @return {Promise<void>}
   * */
  async setLinkTextAlwaysEscapeBrackets(value) {
    await browser.storage.sync.set({
      [SKLinkTextAlwaysEscapeBrackets]: value,
    });
  },

  async setStyleTabGroupIndentation(value) {
    await browser.storage.sync.set({
      [SKStyleTabGroupIndentation]: value,
    });
  },

  async setStyleOfUnrderedList(value) {
    await browser.storage.sync.set({
      [SKStyleOfUnorderedList]: value,
    });
  },

  async reset() {
    await browser.storage.sync.remove(this.keys);
  },

  async getAll() {
    const all = await browser.storage.sync.get(this.defaultSettings);

    return {
      alwaysEscapeLinkBrackets: all[SKLinkTextAlwaysEscapeBrackets],
      styleOfUnorderedList: all[SKStyleOfUnorderedList],
      styleOfTabGroupIndentation: all[SKStyleTabGroupIndentation],
    };
  },
};
