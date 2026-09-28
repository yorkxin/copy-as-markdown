import type { BulletListMarker } from './markdown.js';
import { isBulletListMarker } from './markdown.js';

export type EmDelimiter = '_' | '*';
export type StrongDelimiter = '**' | '__';
export type HeadingStyle = 'atx' | 'setext';
export type Fence = '```' | '~~~';

export function isHeadingStyle(value: unknown): value is HeadingStyle {
  return value === 'atx' || value === 'setext';
}

export function isFence(value: unknown): value is Fence {
  return value === '```' || value === '~~~';
}

export function isEmDelimiter(value: unknown): value is EmDelimiter {
  return value === '_' || value === '*';
}

export function isStrongDelimiter(value: unknown): value is StrongDelimiter {
  return value === '**' || value === '__';
}

export type CodeBlockStyle = 'fenced' | 'indented';

const CodeBlockStyles: CodeBlockStyle[] = ['fenced', 'indented'];

export function isCodeBlockStyle(value: unknown): value is CodeBlockStyle {
  return CodeBlockStyles.includes(value as CodeBlockStyle);
}

export const SelectionSettingKeys = {
  bulletListMarker: 'selection.markdown.bulletListMarker',
  codeBlockStyle: 'selection.markdown.codeBlockStyle',
  emDelimiter: 'selection.markdown.emDelimiter',
  strongDelimiter: 'selection.markdown.strongDelimiter',
  headingStyle: 'selection.markdown.headingStyle',
  fence: 'selection.markdown.fence',
} as const;

export interface SelectionMarkdownSettings {
  bulletListMarker: BulletListMarker;
  codeBlockStyle: CodeBlockStyle;
  emDelimiter: EmDelimiter;
  strongDelimiter: StrongDelimiter;
  headingStyle: HeadingStyle;
  fence: Fence;
}

// Inline and list styles are following defaults from GitHub's Markdown Editor as of Sep 2026.
// Others are based on the extension author's personal preferences.
export const SelectionSettingDefaults: SelectionMarkdownSettings = {
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**',
  headingStyle: 'atx',
  fence: '```',
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
    const emDelimiter = stored[SelectionSettingKeys.emDelimiter];
    const strongDelimiter = stored[SelectionSettingKeys.strongDelimiter];
    const headingStyle = stored[SelectionSettingKeys.headingStyle];
    const fence = stored[SelectionSettingKeys.fence];

    return {
      bulletListMarker: isBulletListMarker(bulletListMarker)
        ? bulletListMarker
        : SelectionSettingDefaults.bulletListMarker,
      codeBlockStyle: isCodeBlockStyle(codeBlockStyle)
        ? codeBlockStyle
        : SelectionSettingDefaults.codeBlockStyle,
      emDelimiter: isEmDelimiter(emDelimiter) ? emDelimiter : SelectionSettingDefaults.emDelimiter,
      strongDelimiter: isStrongDelimiter(strongDelimiter) ? strongDelimiter : SelectionSettingDefaults.strongDelimiter,
      headingStyle: isHeadingStyle(headingStyle) ? headingStyle : SelectionSettingDefaults.headingStyle,
      fence: isFence(fence) ? fence : SelectionSettingDefaults.fence,
    };
  },

  async setBulletListMarker(value: BulletListMarker): Promise<void> {
    await browser.storage.sync.set({ [SelectionSettingKeys.bulletListMarker]: value });
  },

  async setEmDelimiter(value: EmDelimiter): Promise<void> {
    await browser.storage.sync.set({ [SelectionSettingKeys.emDelimiter]: value });
  },

  async setStrongDelimiter(value: StrongDelimiter): Promise<void> {
    await browser.storage.sync.set({ [SelectionSettingKeys.strongDelimiter]: value });
  },

  async setHeadingStyle(value: HeadingStyle): Promise<void> {
    await browser.storage.sync.set({ [SelectionSettingKeys.headingStyle]: value });
  },

  async setFence(value: Fence): Promise<void> {
    await browser.storage.sync.set({ [SelectionSettingKeys.fence]: value });
  },

  async setCodeBlockStyle(value: CodeBlockStyle): Promise<void> {
    await browser.storage.sync.set({ [SelectionSettingKeys.codeBlockStyle]: value });
  },
};
