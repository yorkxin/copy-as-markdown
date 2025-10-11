import '../vendor/browser-polyfill.js';

const SKLinkTextAlwaysEscapeBrackets = 'linkTextAlwaysEscapeBrackets';
const SKStyleOfUnorderedList = 'styleOfUnorderedList ';
const SKStyleTabGroupIndentation = 'style.tabgroup.indentation ';

interface Settings {
  alwaysEscapeLinkBrackets: boolean;
  styleOfUnorderedList: 'dash' | 'asterisk' | 'plus';
  styleOfTabGroupIndentation: 'spaces' | 'tab';
}

/**
 * Singleton Settings object in the sync storage
 */
export default {
  SKLinkTextAlwaysEscapeBrackets,
  SKStyleOfUnorderedList,
  SKStyleTabGroupIndentation,

  get defaultSettings(): Record<string, unknown> {
    return {
      [SKLinkTextAlwaysEscapeBrackets]: false,
      [SKStyleOfUnorderedList]: 'dash',
      [SKStyleTabGroupIndentation]: 'spaces',
    };
  },

  get keys(): string[] {
    return Object.keys(this.defaultSettings);
  },

  async setLinkTextAlwaysEscapeBrackets(value: boolean): Promise<void> {
    await browser.storage.sync.set({
      [SKLinkTextAlwaysEscapeBrackets]: value,
    });
  },

  async setStyleTabGroupIndentation(value: 'spaces' | 'tab'): Promise<void> {
    await browser.storage.sync.set({
      [SKStyleTabGroupIndentation]: value,
    });
  },

  async setStyleOfUnrderedList(value: 'dash' | 'asterisk' | 'plus'): Promise<void> {
    await browser.storage.sync.set({
      [SKStyleOfUnorderedList]: value,
    });
  },

  async reset(): Promise<void> {
    await browser.storage.sync.remove(this.keys);
  },

  async getAll(): Promise<Settings> {
    const all = await browser.storage.sync.get(this.defaultSettings);

    return {
      alwaysEscapeLinkBrackets: all[SKLinkTextAlwaysEscapeBrackets] as boolean,
      styleOfUnorderedList: all[SKStyleOfUnorderedList] as 'dash' | 'asterisk' | 'plus',
      styleOfTabGroupIndentation: all[SKStyleTabGroupIndentation] as 'spaces' | 'tab',
    };
  },
};
