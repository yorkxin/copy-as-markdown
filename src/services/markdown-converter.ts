import type { Options as TurndownOptions } from 'turndown';
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
 * Firefox: convert directly in the Event Page (which has a DOM). The Turndown-
 * bearing module is imported LAZILY so it never enters the Chrome service-worker
 * static import graph when this file is statically imported by background.ts.
 *
 * ⚠️ DO NOT convert the dynamic `import()` below into a top-level static import.
 * See the warning at the call site.
 */
export function createEventPageMarkdownConverter(): MarkdownConverter {
  let htmlToMarkdownPromise: Promise<typeof import('../lib/html-to-markdown.js')> | null = null;

  async function convert(html: string, options: TurndownOptions): Promise<string> {
    if (!htmlToMarkdownPromise) {
      // ⚠️ SERVICE-WORKER SAFETY — KEEP THIS A DYNAMIC import(). DO NOT HOIST TO A
      // STATIC `import ... from '../lib/html-to-markdown.js'` AT THE TOP OF THIS FILE.
      // html-to-markdown.ts statically imports Turndown, which touches the DOM at
      // module load. background.ts statically imports THIS module, so a static import
      // here would pull Turndown into the Chrome MV3 service worker (which has no DOM)
      // and break the background script at load time. The dynamic import keeps
      // html-to-markdown.ts out of the service worker's static graph; it only ever
      // runs on Firefox's Event Page (which has a DOM).
      htmlToMarkdownPromise = import('../lib/html-to-markdown.js');
    }
    const { htmlToMarkdown } = await htmlToMarkdownPromise;
    return htmlToMarkdown(html, options);
  }

  return { convert };
}
