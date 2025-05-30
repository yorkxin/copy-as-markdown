import '../vendor/browser-polyfill.js';

const SKLinkTextAlwaysEscapeBrackets = 'linkTextAlwaysEscapeBrackets';
const SKStyleOfUnorderedList = 'styleOfUnorderedList ';
const SKStyleTabGroupIndentation = 'style.tabgroup.indentation ';

/**
 * @typedef {Object} Settings
 * @property {boolean} alwaysEscapeLinkBrackets
 * @property {'dash'|'asterisk'|'plus'} styleOfUnorderedList
 * @property {'spaces'|'tab'} styleOfTabGroupIndentation
 */

/**
 * Singleton Settings object in the sync storage
 */
export default {
  SKLinkTextAlwaysEscapeBrackets,
  SKStyleOfUnorderedList,
  SKStyleTabGroupIndentation,

  /**
   * @returns {Settings}
   */
  get defaultSettings() {
    return {
      [SKLinkTextAlwaysEscapeBrackets]: false,
      [SKStyleOfUnorderedList]: 'dash',
      [SKStyleTabGroupIndentation]: 'spaces',
    };
  },

  /**
   * @returns {string[]}
   */
  get keys() {
    return Object.keys(this.defaultSettings);
  },

  /**
   * @param {boolean} value
   * @return {Promise<void>}
   */
  async setLinkTextAlwaysEscapeBrackets(value) {
    await browser.storage.sync.set({
      [SKLinkTextAlwaysEscapeBrackets]: value,
    });
  },

  /**
   * @param {'spaces'|'tab'} value
   * @return {Promise<void>}
   */
  async setStyleTabGroupIndentation(value) {
    await browser.storage.sync.set({
      [SKStyleTabGroupIndentation]: value,
    });
  },

  /**
   * @param {'dash'|'asterisk'|'plus'} value
   * @return {Promise<void>}
   */
  async setStyleOfUnrderedList(value) {
    await browser.storage.sync.set({
      [SKStyleOfUnorderedList]: value,
    });
  },

  /**
   * @return {Promise<void>}
   */
  async reset() {
    await browser.storage.sync.remove(this.keys);
  },

  /**
   * @returns {Promise<Settings>}
   */ 
  async getAll() {
    const all = await browser.storage.sync.get(this.defaultSettings);

    return {
      alwaysEscapeLinkBrackets: all[SKLinkTextAlwaysEscapeBrackets],
      styleOfUnorderedList: all[SKStyleOfUnorderedList],
      styleOfTabGroupIndentation: all[SKStyleTabGroupIndentation],
    };
  },
};
