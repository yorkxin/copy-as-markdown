import type { Options as TurndownOptions } from 'turndown';
import { htmlToMarkdown } from '../lib/html-to-markdown.js';
import type { OffscreenDocumentService } from './offscreen-document-service.js';
import type { OffscreenMarkdownResponse } from '../contracts/offscreen-messages.js';
import { OFFSCREEN_MARKDOWN_TARGET } from '../contracts/offscreen-messages.js';

export interface MarkdownConverter {
  convert: (html: string, options: TurndownOptions) => Promise<string>;
}

/**
 * Chrome: convert in the shared offscreen document. Imports no DOM/Turndown code.
 */
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
 * Firefox: convert directly in the Event Page (which has a DOM).
 *
 * `html-to-markdown` (which statically imports Turndown) is a NORMAL static
 * import above. On the Chrome build, `BUILD_TARGET` dead-code elimination drops
 * the call to this function in background.ts, so esbuild tree-shakes this
 * function — and html-to-markdown/Turndown — out of the Chrome service-worker
 * bundle. That exclusion is enforced by scripts/assert-no-turndown.js and
 * test/build/no-turndown-in-chrome-background.test.ts.
 */
export function createEventPageMarkdownConverter(): MarkdownConverter {
  async function convert(html: string, options: TurndownOptions): Promise<string> {
    return htmlToMarkdown(html, options);
  }

  return { convert };
}
