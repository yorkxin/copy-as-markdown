import type { BulletListMarker } from './markdown.js';
import { isBulletListMarker, isTabGroupIndentationStyle, TabGroupIndentationStyle } from './markdown.js';

export const MultipleLinksSettingKeys = {
  bulletListMarker: 'multipleLinks.markdown.bulletListMarker',
  tabGroupIndentation: 'multipleLinks.markdown.tabGroupIndentation',
} as const;

export interface MultipleLinksMarkdownSettings {
  bulletListMarker: BulletListMarker;
  tabGroupIndentation: TabGroupIndentationStyle;
}

export const MultipleLinksSettingDefaults: MultipleLinksMarkdownSettings = {
  bulletListMarker: '-',
  tabGroupIndentation: TabGroupIndentationStyle.Spaces,
};

/**
 * Markdown settings owned by the Multiple Links context.
 *
 * Only the built-in list marker lives here; task lists keep their fixed
 * `- [ ]` marker. Persisted values are validated per setting and an invalid
 * stored value is never rewritten during a read.
 *
 * Resetting this context lives in `markdown-settings.ts`, for the reason given
 * on the Copy Selection settings module.
 */
export default {
  keys: Object.values(MultipleLinksSettingKeys) as string[],
  defaultSettings: MultipleLinksSettingDefaults,

  async getAll(): Promise<MultipleLinksMarkdownSettings> {
    const stored = await browser.storage.sync.get(this.keys);
    const bulletListMarker = stored[MultipleLinksSettingKeys.bulletListMarker];
    const tabGroupIndentation = stored[MultipleLinksSettingKeys.tabGroupIndentation];

    return {
      bulletListMarker: isBulletListMarker(bulletListMarker)
        ? bulletListMarker
        : MultipleLinksSettingDefaults.bulletListMarker,
      tabGroupIndentation: isTabGroupIndentationStyle(tabGroupIndentation)
        ? tabGroupIndentation
        : MultipleLinksSettingDefaults.tabGroupIndentation,
    };
  },

  async setBulletListMarker(value: BulletListMarker): Promise<void> {
    await browser.storage.sync.set({ [MultipleLinksSettingKeys.bulletListMarker]: value });
  },

  async setTabGroupIndentation(value: TabGroupIndentationStyle): Promise<void> {
    await browser.storage.sync.set({ [MultipleLinksSettingKeys.tabGroupIndentation]: value });
  },
};
