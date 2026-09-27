import type { BulletListMarker } from './markdown.js';
import { isBulletListMarker } from './markdown.js';

export type CodeBlockStyle = 'fenced' | 'indented';

const CodeBlockStyles: CodeBlockStyle[] = ['fenced', 'indented'];

export function isCodeBlockStyle(value: unknown): value is CodeBlockStyle {
  return CodeBlockStyles.includes(value as CodeBlockStyle);
}

export const SelectionSettingKeys = {
  bulletListMarker: 'selection.markdown.bulletListMarker',
  codeBlockStyle: 'selection.markdown.codeBlockStyle',
} as const;

export interface SelectionMarkdownSettings {
  bulletListMarker: BulletListMarker;
  codeBlockStyle: CodeBlockStyle;
}

export const SelectionSettingDefaults: SelectionMarkdownSettings = {
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
};

/** Reset is centralized in markdown-settings.ts because retiring the shared marker requires both contexts. */
export default {
  keys: Object.values(SelectionSettingKeys) as string[],
  defaultSettings: SelectionSettingDefaults,

  /**
   * Invalid stored values fall back to defaults without being rewritten because
   * they may belong to a newer version.
   */
  async getAll(): Promise<SelectionMarkdownSettings> {
    const stored = await browser.storage.sync.get(this.keys);
    const bulletListMarker = stored[SelectionSettingKeys.bulletListMarker];
    const codeBlockStyle = stored[SelectionSettingKeys.codeBlockStyle];

    return {
      bulletListMarker: isBulletListMarker(bulletListMarker)
        ? bulletListMarker
        : SelectionSettingDefaults.bulletListMarker,
      codeBlockStyle: isCodeBlockStyle(codeBlockStyle)
        ? codeBlockStyle
        : SelectionSettingDefaults.codeBlockStyle,
    };
  },

  async setBulletListMarker(value: BulletListMarker): Promise<void> {
    await browser.storage.sync.set({ [SelectionSettingKeys.bulletListMarker]: value });
  },

  async setCodeBlockStyle(value: CodeBlockStyle): Promise<void> {
    await browser.storage.sync.set({ [SelectionSettingKeys.codeBlockStyle]: value });
  },
};
