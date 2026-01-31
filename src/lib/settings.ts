import '../vendor/browser-polyfill.js';
import { TabGroupIndentationStyle, UnorderedListStyle } from './markdown.js';

const SKLinkTextAlwaysEscapeBrackets = 'linkTextAlwaysEscapeBrackets';
// [sic.] The following keys have spaces at the end since they were introduced (typo). Do not modify.
const SKStyleOfUnorderedList = 'styleOfUnorderedList ';
const SKStyleTabGroupIndentation = 'style.tabgroup.indentation ';
const SKDecodeURLs = 'decodeURLs';

interface Settings {
  alwaysEscapeLinkBrackets: boolean;
  styleOfUnorderedList: UnorderedListStyle;
  styleOfTabGroupIndentation: TabGroupIndentationStyle;
  decodeURLs: boolean;
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
      [SKStyleOfUnorderedList]: UnorderedListStyle.Dash,
      [SKStyleTabGroupIndentation]: TabGroupIndentationStyle.Spaces,
      [SKDecodeURLs]: false,
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

  async setStyleTabGroupIndentation(value: TabGroupIndentationStyle): Promise<void> {
    await browser.storage.sync.set({
      [SKStyleTabGroupIndentation]: value,
    });
  },

  async setStyleOfUnrderedList(value: UnorderedListStyle): Promise<void> {
    await browser.storage.sync.set({
      [SKStyleOfUnorderedList]: value,
    });
  },

  async setDecodeURLs(value: boolean): Promise<void> {
    await browser.storage.sync.set({
      [SKDecodeURLs]: value,
    });
  },

  async reset(): Promise<void> {
    await browser.storage.sync.remove(this.keys);
  },

  async getAll(): Promise<Settings> {
    const all = await browser.storage.sync.get(this.defaultSettings);

    return {
      alwaysEscapeLinkBrackets: all[SKLinkTextAlwaysEscapeBrackets] as boolean,
      styleOfUnorderedList: all[SKStyleOfUnorderedList] as UnorderedListStyle,
      styleOfTabGroupIndentation: all[SKStyleTabGroupIndentation] as TabGroupIndentationStyle,
      decodeURLs: all[SKDecodeURLs] as boolean,
    };
  },
};
