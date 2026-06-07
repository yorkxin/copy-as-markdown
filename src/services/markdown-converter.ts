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
 * Firefox: convert directly in the Event Page (which has a DOM).
 *
 * The Turndown-bearing module (`html-to-markdown`) is imported via a DYNAMIC
 * `import()` so it never enters the STATIC import graph of this module. That
 * matters because background.ts statically imports this module (for
 * `createOffscreenMarkdownConverter`), and the Chrome MV3 service worker — which
 * has no DOM — must not bundle Turndown. A static import here would pull Turndown
 * into chrome/dist/background.js for its module-load side effects even though
 * Chrome never calls this function.
 *
 * Why a dynamic import and not a BUILD_TARGET stub/alias: on Chrome, Turndown is
 * still required by the OTHER entry, src/offscreen.ts (the Chrome conversion path),
 * so it cannot be globally excluded from the Chrome build — only from the
 * background entry. The dynamic import is what gives that per-entry exclusion.
 *
 * On Chrome, background.ts selects the converter via `BUILD_TARGET`, so the call
 * to this function is dead-code-eliminated and the function (with its dynamic
 * import) is tree-shaken away. The resulting absence of Turndown from
 * chrome/dist/background.js is ENFORCED by scripts/assert-no-turndown.js and
 * test/build/no-turndown-in-chrome-background.test.ts (it is no longer a
 * hand-maintained invariant).
 */
export function createEventPageMarkdownConverter(): MarkdownConverter {
  let htmlToMarkdownPromise: Promise<typeof import('../lib/html-to-markdown.js')> | null = null;

  async function convert(html: string, options: TurndownOptions): Promise<string> {
    if (!htmlToMarkdownPromise) {
      // KEEP THIS A DYNAMIC import() — see the function doc above. Hoisting it to a
      // static top-level import re-introduces Turndown into chrome/dist/background.js
      // and the no-turndown assertion/test will fail.
      htmlToMarkdownPromise = import('../lib/html-to-markdown.js');
    }
    const { htmlToMarkdown } = await htmlToMarkdownPromise;
    return htmlToMarkdown(html, options);
  }

  return { convert };
}
