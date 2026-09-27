import type { Options as TurndownOptions } from 'turndown';
import type { OffscreenDocumentService } from './offscreen-document-service.js';
import type { OffscreenMarkdownResponse } from '../contracts/offscreen-messages.js';
import { OFFSCREEN_MARKDOWN_TARGET } from '../contracts/offscreen-messages.js';

export interface MarkdownConverter {
  convert: (html: string, options: TurndownOptions) => Promise<string>;
}

export function createOffscreenMarkdownConverter(
  documentService: OffscreenDocumentService,
): MarkdownConverter {
  async function convert(html: string, options: TurndownOptions): Promise<string> {
    const response = await documentService.sendMessage<OffscreenMarkdownResponse | undefined>({
      target: OFFSCREEN_MARKDOWN_TARGET,
      html,
      options,
    });
    if (!response?.ok) {
      throw new Error(`offscreen markdown conversion failed: ${response?.error ?? 'no response'}`);
    }
    return response.markdown ?? '';
  }

  return { convert };
}

/**
 * Firefox converts in its DOM-bearing Event Page. The dynamic import keeps
 * Turndown out of Chrome's service-worker entry while offscreen.ts imports it
 * statically for Chrome's DOM conversion path. A target-wide alias cannot
 * provide this per-entry boundary; the no-Turndown build assertion enforces it.
 */
export function createEventPageMarkdownConverter(): MarkdownConverter {
  let htmlToMarkdownPromise: Promise<typeof import('../lib/html-to-markdown.js')> | null = null;

  async function convert(html: string, options: TurndownOptions): Promise<string> {
    if (!htmlToMarkdownPromise) {
      htmlToMarkdownPromise = import('../lib/html-to-markdown.js');
    }
    const { htmlToMarkdown } = await htmlToMarkdownPromise;
    return htmlToMarkdown(html, options);
  }

  return { convert };
}
