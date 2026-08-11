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

/**
 * Markdown settings owned by the Copy Selection context.
 *
 * Persisted values are untrusted: each setting is validated against this
 * context's allowlist and falls back on its own default when invalid. An
 * invalid stored value is never rewritten during a read — it may belong to a
 * newer version of the extension.
 */
export default {
  keys: Object.values(SelectionSettingKeys) as string[],
  defaultSettings: SelectionSettingDefaults,

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

  async reset(): Promise<void> {
    await browser.storage.sync.remove(this.keys);
  },
};
