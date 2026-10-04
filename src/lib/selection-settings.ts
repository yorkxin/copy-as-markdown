import type { BulletListMarker } from './markdown.js';
import { isBulletListMarker } from './markdown.js';

export type EmDelimiter = '_' | '*';
export type StrongDelimiter = '**' | '__';
export type HeadingStyle = 'atx' | 'setext';
export type Fence = '```' | '~~~';
export type LinkStyle = 'inlined' | 'referenced';
export type LinkReferenceStyle = 'full' | 'collapsed' | 'shortcut';

export function isLinkStyle(value: unknown): value is LinkStyle {
  return value === 'inlined' || value === 'referenced';
}

export function isLinkReferenceStyle(value: unknown): value is LinkReferenceStyle {
  return value === 'full' || value === 'collapsed' || value === 'shortcut';
}

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
  linkStyle: 'selection.markdown.linkStyle',
  linkReferenceStyle: 'selection.markdown.linkReferenceStyle',
} as const;

export interface SelectionMarkdownSettings {
  bulletListMarker: BulletListMarker;
  codeBlockStyle: CodeBlockStyle;
  emDelimiter: EmDelimiter;
  strongDelimiter: StrongDelimiter;
  headingStyle: HeadingStyle;
  fence: Fence;
  linkStyle: LinkStyle;
  linkReferenceStyle: LinkReferenceStyle;
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
  linkStyle: 'inlined',
  linkReferenceStyle: 'full',
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
    const linkStyle = stored[SelectionSettingKeys.linkStyle];
    const linkReferenceStyle = stored[SelectionSettingKeys.linkReferenceStyle];

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
      linkStyle: isLinkStyle(linkStyle) ? linkStyle : SelectionSettingDefaults.linkStyle,
      linkReferenceStyle: isLinkReferenceStyle(linkReferenceStyle)
        ? linkReferenceStyle
        : SelectionSettingDefaults.linkReferenceStyle,
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

  async setLinkStyle(value: LinkStyle): Promise<void> {
    await browser.storage.sync.set({ [SelectionSettingKeys.linkStyle]: value });
  },

  async setLinkReferenceStyle(value: LinkReferenceStyle): Promise<void> {
    await browser.storage.sync.set({ [SelectionSettingKeys.linkReferenceStyle]: value });
  },

  /** A referenced output choice updates both keys together, avoiding an intermediate format. */
  async setReferencedLinkStyle(value: LinkReferenceStyle): Promise<void> {
    await browser.storage.sync.set({
      [SelectionSettingKeys.linkStyle]: 'referenced',
      [SelectionSettingKeys.linkReferenceStyle]: value,
    });
  },

  async setCodeBlockStyle(value: CodeBlockStyle): Promise<void> {
    await browser.storage.sync.set({ [SelectionSettingKeys.codeBlockStyle]: value });
  },
};
