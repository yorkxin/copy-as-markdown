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
 * The marker configures unordered lists only; task lists keep their fixed `- [ ]` marker.
 * Reset is centralized in markdown-settings.ts because retiring the shared marker requires both contexts.
 */
export default {
  keys: Object.values(MultipleLinksSettingKeys) as string[],
  defaultSettings: MultipleLinksSettingDefaults,

  /**
   * Invalid stored values fall back to defaults without being rewritten because
   * they may belong to a newer version.
   */
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
