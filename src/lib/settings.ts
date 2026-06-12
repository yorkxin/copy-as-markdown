import browserPolyfill from 'webextension-polyfill';
import { TabGroupIndentationStyle, UnorderedListStyle } from './markdown.js';

// The polyfill assigns `globalThis.browser` itself only when it runs as a classic
// script (how the UI pages load it via <script src="../vendor/browser-polyfill.js">).
// Bundled by esbuild it is a CommonJS module — the UMD branch that sets the global
// never runs — so assign it explicitly. `??=` keeps the page-loaded instance when
// one already exists (and Firefox's native `browser`), matching the old vendored
// side-effect import.
(globalThis as any).browser ??= browserPolyfill;

const SKLinkTextAlwaysEscapeBrackets = 'linkTextAlwaysEscapeBrackets';
// [sic.] The following keys have spaces at the end since they were introduced (typo). Do not modify.
const SKStyleOfUnorderedList = 'styleOfUnorderedList ';
const SKStyleTabGroupIndentation = 'style.tabgroup.indentation ';
const SKStyleOfCodeBlock = 'styleOfCodeBlock';

export type CodeBlockStyle = 'fenced' | 'indented';

interface Settings {
  alwaysEscapeLinkBrackets: boolean;
  styleOfUnorderedList: UnorderedListStyle;
  styleOfTabGroupIndentation: TabGroupIndentationStyle;
  styleOfCodeBlock: CodeBlockStyle;
}

/**
 * Singleton Settings object in the sync storage
 */
export default {
  SKLinkTextAlwaysEscapeBrackets,
  SKStyleOfUnorderedList,
  SKStyleTabGroupIndentation,
  SKStyleOfCodeBlock,

  get defaultSettings(): Record<string, unknown> {
    return {
      [SKLinkTextAlwaysEscapeBrackets]: false,
      [SKStyleOfUnorderedList]: UnorderedListStyle.Dash,
      [SKStyleTabGroupIndentation]: TabGroupIndentationStyle.Spaces,
      [SKStyleOfCodeBlock]: 'fenced',
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

  async setStyleOfCodeBlock(value: CodeBlockStyle): Promise<void> {
    await browser.storage.sync.set({
      [SKStyleOfCodeBlock]: value,
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
      styleOfCodeBlock: all[SKStyleOfCodeBlock] as CodeBlockStyle,
    };
  },
};
