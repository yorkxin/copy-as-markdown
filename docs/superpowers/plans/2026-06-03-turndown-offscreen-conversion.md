# Move Turndown Execution Out of Page Contexts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop running Turndown.js inside arbitrary web pages; run the HTML→Markdown conversion in an extension-origin DOM context (a shared offscreen document on Chrome, the Event Page on Firefox), while keeping selection extraction in the page.

**Architecture:** Split the current page-side `selectionToMarkdown` into two phases: `extractSelectionHtml(onlyIfFocused)` stays in the page (clones the selection, absolutizes URLs, normalizes `<pre>`, applies the focused-leaf-frame filter, returns HTML), and `htmlToMarkdown(html, options)` runs Turndown in a DOM-bearing extension context. A `MarkdownConverter` interface is selected at the composition root (`background.ts`) via a new flag and injected into the selection-converter service — no runtime capability checks in the service. On Chrome the converter posts to a single shared offscreen document (reasons `CLIPBOARD` + `DOM_PARSER`) that also serves clipboard writes; on Firefox it runs Turndown directly in the Event Page via a lazy import that keeps Turndown out of the Chrome service-worker static graph.

**Tech Stack:** TypeScript (NodeNext ESM), Web Extension MV3 (Chrome service worker + Firefox event page), Turndown + `@truto/turndown-plugin-gfm` (vendored), Vitest (`unit` node project + `browser` playwright project), Playwright e2e.

**Reference spec:** `docs/superpowers/specs/2026-06-02-turndown-offscreen-conversion-design.md`

---

## File Structure

**New files:**
- `src/shims/turndown.js` — runtime re-export of vendored Turndown (compiled/copied to `dist/shims/`).
- `src/shims/turndown.d.ts` — types for the Turndown shim (maps to `turndown` package types).
- `src/shims/turndown-plugin-gfm.js` — runtime re-export of vendored GFM plugin.
- `src/shims/turndown-plugin-gfm.d.ts` — types for the GFM shim (maps to `@truto/turndown-plugin-gfm`).
- `src/lib/html-to-markdown.ts` — `htmlToMarkdown(html, options)`; statically imports the Turndown shims; requires a DOM.
- `src/services/offscreen-document-service.ts` — single-offscreen-document lifecycle (`ensureDocument` with both reasons + `sendMessage`).
- `src/services/markdown-converter.ts` — `MarkdownConverter` interface + `createOffscreenMarkdownConverter` (Chrome) + `createEventPageMarkdownConverter` (Firefox, lazy-imports `html-to-markdown`).
- `src/contracts/offscreen-messages.ts` — message contracts for offscreen-document traffic (clipboard + convert).
- `test/lib/html-to-markdown.spec.ts` — **browser** project (needs DOM); conversion behavior.
- `test/services/offscreen-document-service.test.ts` — **unit**; document lifecycle.
- `test/services/markdown-converter.test.ts` — `markdown-converter` (offscreen converter is unit; event-page converter test lives in the browser project — see Task 9).

**Modified files:**
- `firefox-mv3/hacks.js` — add the new flag global.
- `src/config/flags.ts` — add `convertMarkdownInBackground`.
- `src/content-scripts/selection-to-markdown.ts` — replace `selectionToMarkdown` with `extractSelectionHtml(onlyIfFocused)`.
- `src/offscreen.ts` — route by message target; add convert handler; use contracts.
- `src/services/offscreen-clipboard-service.ts` — delegate document lifecycle to `offscreen-document-service`; keep `copy(text)` wrapper.
- `src/services/clipboard-service.ts` — thread an injected `OffscreenDocumentService | null` through the controller/factory.
- `src/services/selection-converter-service.ts` — inject a `MarkdownConverter`; call `extractSelectionHtml`; drop the URL params.
- `src/background.ts` — build the offscreen-document service + converter, wire by flag.
- `chrome/manifest.json`, `firefox-mv3/manifest.json` — remove Turndown `web_accessible_resources`.
- `test/services/selection-converter-service.test.ts` — rewrite for HTML extraction + injected converter.
- `test/services/offscreen-clipboard-service.test.ts` — rewrite to assert delegation to a mocked document service.
- `test/services/clipboard-service.test.ts` — update for the new signature.
- `test/offscreen.test.ts` — add convert-handler coverage; keep clipboard coverage.
- `test/ui/selection-list-paragraph.spec.ts`, `test/ui/selection-code-block.spec.ts`, `test/ui/selection-trailing-newlines.spec.ts`, `test/ui/selection-focus-frame.spec.ts` — recompose `extractSelectionHtml` + `htmlToMarkdown`.

**Key behavior to preserve (do not regress):**
- Conversion returns **one** frame's Markdown (the focused leaf, or the explicitly targeted frame) — there is **no `\n\n` joining**.
- The focused-leaf-frame heuristic (`document.hasFocus()` + `activeElement` not a sub-frame) runs **in the page**, gated by `onlyIfFocused`.
- Trailing newlines are trimmed (`.replace(/\n+$/, '')`).
- `frameId === undefined` ⇒ `allFrames: true` + `onlyIfFocused: true`; an explicit `frameId` (including `0`) ⇒ `frameIds: [frameId]` + `onlyIfFocused: false`.

---

## Task 1: Add the `CONVERT_MARKDOWN_IN_BACKGROUND` flag

**Files:**
- Modify: `src/config/flags.ts`
- Modify: `firefox-mv3/hacks.js`

A new, purpose-named flag — deliberately separate from `ALWAYS_USE_NAVIGATOR_COPY_API` so "how to write the clipboard" and "where to run Turndown" stay independent.

- [ ] **Step 1: Add the flag accessor**

In `src/config/flags.ts`, add the accessor to the `Flags` object:

```ts
export const Flags = {
  alwaysUseNavigatorClipboard: () => getBooleanFlag('ALWAYS_USE_NAVIGATOR_COPY_API'),
  periodicallyRefreshMenu: () => getBooleanFlag('PERIDOCIALLY_REFRESH_MENU'),
  convertMarkdownInBackground: () => getBooleanFlag('CONVERT_MARKDOWN_IN_BACKGROUND'),
};
```

- [ ] **Step 2: Set the global in the Firefox hacks file**

`firefox-mv3/hacks.js` becomes:

```js
globalThis.ALWAYS_USE_NAVIGATOR_COPY_API = true;
globalThis.CONVERT_MARKDOWN_IN_BACKGROUND = true;
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/config/flags.ts firefox-mv3/hacks.js
git commit -m "feat: add CONVERT_MARKDOWN_IN_BACKGROUND flag"
```

---

## Task 2: Add the Turndown vendor shims

**Files:**
- Create: `src/shims/turndown.js`
- Create: `src/shims/turndown.d.ts`
- Create: `src/shims/turndown-plugin-gfm.js`
- Create: `src/shims/turndown-plugin-gfm.d.ts`

Mirrors the existing `src/shims/mustache.{js,d.ts}` pattern so DOM-context code can statically import the vendored modules with types. `.js` files are copied as-is by `tsc` (`allowJs: true`) into `dist/shims/`; the vendored `.mjs` files are copied to `dist/vendor/` by `scripts/compile.js`.

- [ ] **Step 1: Create the Turndown runtime shim**

`src/shims/turndown.js`:

```js
// Shim to re-export the vendored Turndown library at runtime.
// This file is NOT compiled by TypeScript - it's copied as-is.
export * from '../vendor/turndown.mjs';
export { default } from '../vendor/turndown.mjs';
```

- [ ] **Step 2: Create the Turndown type shim**

`src/shims/turndown.d.ts`:

```ts
// Type definitions for the Turndown shim — maps to the `turndown` package types.
export * from 'turndown';
export { default } from 'turndown';
```

- [ ] **Step 3: Create the GFM plugin runtime shim**

`src/shims/turndown-plugin-gfm.js`:

```js
// Shim to re-export the vendored GFM plugin at runtime.
// This file is NOT compiled by TypeScript - it's copied as-is.
export * from '../vendor/turndown-plugin-gfm.mjs';
```

- [ ] **Step 4: Create the GFM plugin type shim**

`src/shims/turndown-plugin-gfm.d.ts`:

```ts
// Type definitions for the GFM plugin shim — maps to `@truto/turndown-plugin-gfm`.
export * from '@truto/turndown-plugin-gfm';
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (No code imports the shims yet; this verifies the type re-exports resolve.)

- [ ] **Step 6: Commit**

```bash
git add src/shims/turndown.js src/shims/turndown.d.ts src/shims/turndown-plugin-gfm.js src/shims/turndown-plugin-gfm.d.ts
git commit -m "feat: add Turndown + GFM vendor shims"
```

---

## Task 3: Extract `htmlToMarkdown` into `src/lib/html-to-markdown.ts`

**Files:**
- Create: `src/lib/html-to-markdown.ts`
- Test: `test/lib/html-to-markdown.spec.ts` (browser project — needs a real DOM)

Moves the option-dependent Turndown conversion (build service, `.remove('script'/'style')`, GFM tables plugin, single-paragraph-list-item rule, trailing-newline trim) out of the content script into a reusable, DOM-context module. This is the **only** module that statically imports Turndown.

- [ ] **Step 1: Write the failing test**

`test/lib/html-to-markdown.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { htmlToMarkdown } from '../../src/lib/html-to-markdown.js';

const OPTS = { headingStyle: 'atx' as const, bulletListMarker: '-' as const };

describe('htmlToMarkdown', () => {
  it('converts headings and paragraphs', () => {
    expect(htmlToMarkdown('<h1>Hello</h1><p>World</p>', OPTS)).toBe('# Hello\n\nWorld');
  });

  it('trims trailing newlines', () => {
    expect(htmlToMarkdown('<p>x</p>', OPTS)).toBe('x');
  });

  it('flattens single-paragraph list items (tight list)', () => {
    expect(htmlToMarkdown('<ul><li><p>a</p></li><li><p>b</p></li></ul>', OPTS))
      .toBe('-   a\n-   b');
  });

  it('keeps loose formatting for multi-paragraph list items', () => {
    expect(htmlToMarkdown('<ul><li><p>a</p><p>b</p></li></ul>', OPTS))
      .toBe('-   a\n    \n    b');
  });

  it('removes script and style elements', () => {
    expect(htmlToMarkdown('<p>keep</p><script>bad()</script><style>.x{}</style>', OPTS))
      .toBe('keep');
  });

  it('renders GFM tables', () => {
    const html = '<table><thead><tr><th>A</th><th>B</th></tr></thead>'
      + '<tbody><tr><td>1</td><td>2</td></tr></tbody></table>';
    expect(htmlToMarkdown(html, OPTS)).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project browser test/lib/html-to-markdown.spec.ts`
Expected: FAIL — cannot resolve `../../src/lib/html-to-markdown.js` (module does not exist).

- [ ] **Step 3: Implement `html-to-markdown.ts`**

`src/lib/html-to-markdown.ts`:

```ts
import type { Options as TurndownOptions, Rule } from 'turndown';
import TurndownService from '../shims/turndown.js';
import { tables } from '../shims/turndown-plugin-gfm.js';

// Turndown wraps <p> with blank lines, and inside <li> that becomes an indented
// blank line between bullet items (e.g. "- item\n    \n- item"), which breaks
// tight-list formatting for common selections like <li><p>...</p></li>.
// This rule flattens only single-paragraph list items and leaves multi-paragraph
// or nested-list items on Turndown's default loose-list behavior.
const singleParagraphInListItemRule: Rule = {
  filter(node) {
    const parent = node.parentElement;
    return (
      node.nodeName === 'P'
      && parent?.nodeName === 'LI'
      && parent.childElementCount === 1
    );
  },
  replacement(content) {
    return content;
  },
};

/**
 * Convert an HTML fragment to Markdown. Requires a DOM (Turndown parses HTML via
 * the DOM API), so this only runs in a DOM-bearing context: the offscreen document
 * (Chrome) or the Event Page (Firefox) — never the service worker.
 */
export function htmlToMarkdown(html: string, options: TurndownOptions): string {
  const turndownService = new TurndownService(options)
    .remove('script')
    .remove('style');
  turndownService.use(tables);
  turndownService.addRule('singleParagraphInListItem', singleParagraphInListItemRule);
  return turndownService.turndown(html).replace(/\n+$/, '');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --project browser test/lib/html-to-markdown.spec.ts`
Expected: PASS (all 6).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/html-to-markdown.ts test/lib/html-to-markdown.spec.ts
git commit -m "feat: extract htmlToMarkdown into a DOM-context module"
```

---

## Task 4: Split the content script into `extractSelectionHtml`

**Files:**
- Modify: `src/content-scripts/selection-to-markdown.ts`
- Test: `test/ui/selection-extract.spec.ts` (new, browser project)

`extractSelectionHtml(onlyIfFocused)` keeps everything that depends on the live page (focus heuristic, selection cloning, URL absolutization, `<pre>` normalization) and returns the container's `innerHTML`. It no longer imports Turndown and no longer takes options. Returns `''` when the frame is not the focused leaf or has no selection.

- [ ] **Step 1: Write the failing test**

`test/ui/selection-extract.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { extractSelectionHtml } from '../../src/content-scripts/selection-to-markdown.js';

function selectNodeContents(selector: string): void {
  const node = document.querySelector(selector)!;
  const range = document.createRange();
  range.selectNodeContents(node);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

describe('extractSelectionHtml', () => {
  it('returns the selected fragment HTML', () => {
    document.body.innerHTML = '<div id="s"><h1>Hi</h1></div>';
    try {
      selectNodeContents('#s');
      expect(extractSelectionHtml(false)).toBe('<h1>Hi</h1>');
    } finally {
      window.getSelection()?.removeAllRanges();
      document.body.innerHTML = '';
    }
  });

  it('absolutizes relative anchor hrefs', () => {
    document.body.innerHTML = '<div id="s"><a href="/foo">x</a></div>';
    try {
      selectNodeContents('#s');
      const html = extractSelectionHtml(false);
      expect(html).toContain(`href="${location.origin}/foo"`);
    } finally {
      window.getSelection()?.removeAllRanges();
      document.body.innerHTML = '';
    }
  });

  it('returns empty string when there is no selection', () => {
    window.getSelection()?.removeAllRanges();
    expect(extractSelectionHtml(false)).toBe('');
  });

  it('returns empty string when onlyIfFocused and a sub-frame is the active element', () => {
    document.body.innerHTML = '<div id="s"><h1>Hi</h1></div><iframe id="f"></iframe>';
    try {
      selectNodeContents('#s');
      (document.querySelector('#f') as HTMLIFrameElement).focus();
      expect(extractSelectionHtml(true)).toBe('');
    } finally {
      window.getSelection()?.removeAllRanges();
      document.body.innerHTML = '';
    }
  });

  it('returns the fragment when onlyIfFocused and this is the focused leaf', () => {
    document.body.innerHTML = '<button id="a">x</button><div id="s"><h1>Hi</h1></div>';
    try {
      (document.querySelector('#a') as HTMLButtonElement).focus();
      selectNodeContents('#s');
      expect(extractSelectionHtml(true)).toBe('<h1>Hi</h1>');
    } finally {
      window.getSelection()?.removeAllRanges();
      document.body.innerHTML = '';
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project browser test/ui/selection-extract.spec.ts`
Expected: FAIL — `extractSelectionHtml` is not exported.

- [ ] **Step 3: Rewrite `selection-to-markdown.ts`**

Replace the entire file contents with:

```ts
/**
 * This function executes in the content script context.
 * It must be self-contained - no external function calls.
 *
 * NOTE: This function should be executed in a content script. It extracts the
 * current selection as an HTML fragment; the HTML→Markdown conversion happens
 * elsewhere (offscreen document on Chrome / Event Page on Firefox).
 */
export function extractSelectionHtml(onlyIfFocused: boolean): string {
  // When triggered without a precise frame (keyboard shortcut), this function runs in
  // every frame. Only the frame the user is actually in should contribute text. A frame
  // is the focused leaf when the document has focus AND its active element is not a nested
  // frame (ancestors of the focused frame report hasFocus() too, but their activeElement is
  // the child frame element). Background iframes that auto-select text do not have focus.
  if (onlyIfFocused) {
    const active = document.activeElement;
    // HTMLFrameElement is the legacy <frame> (framesets); kept for completeness even
    // though modern pages only use <iframe>.
    const activeIsSubFrame
      = active instanceof HTMLIFrameElement || active instanceof HTMLFrameElement;
    if (!document.hasFocus() || activeIsSubFrame) {
      return '';
    }
  }

  const sel = getSelection();
  if (!sel) {
    return '';
  }

  const container = document.createElement('div');
  for (let i = 0, len = sel.rangeCount; i < len; i += 1) {
    container.appendChild(sel.getRangeAt(i).cloneContents());
  }

  // Fix <a href> so that they are absolute URLs
  container.querySelectorAll('a').forEach((value) => {
    value.setAttribute('href', value.href);
  });

  // Fix <img src> so that they are absolute URLs
  container.querySelectorAll('img').forEach((value) => {
    value.setAttribute('src', value.src);
  });

  // Normalize wrapped PRE blocks into canonical <pre><code>...</code></pre>.
  // This keeps matching conservative and delegates markdown rendering details
  // (fenced vs indented, language handling, fence sizing) to Turndown built-ins.
  container.querySelectorAll('pre').forEach((pre) => {
    if (pre.firstElementChild?.nodeName === 'CODE') {
      return;
    }

    const codeNodes = pre.querySelectorAll('code');
    if (codeNodes.length !== 1) {
      return;
    }

    const codeNode = codeNodes[0]!;
    const className = codeNode.getAttribute('class') || '';
    const hasLanguageClass = /\blanguage-\S+\b/.test(className);
    const codeText = codeNode.textContent || '';
    const hasMultilineCode = codeText.includes('\n');

    // Conservative matcher: avoid rewriting instructional <pre> content.
    if (!hasLanguageClass && !hasMultilineCode) {
      return;
    }

    const normalizedCode = document.createElement('code');
    if (className) {
      normalizedCode.setAttribute('class', className);
    }
    normalizedCode.textContent = codeText;
    pre.replaceChildren(normalizedCode);
  });

  return container.innerHTML;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --project browser test/ui/selection-extract.spec.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add src/content-scripts/selection-to-markdown.ts test/ui/selection-extract.spec.ts
git commit -m "feat: split selection extraction from markdown conversion"
```

> NOTE: `npm run typecheck` will now FAIL because `selection-converter-service.ts` and the existing `test/ui/selection-*.spec.ts` files still reference the removed `selectionToMarkdown`. Those are fixed in Tasks 9 and 10. This is expected mid-refactor; do not "fix" it by re-adding the old export.

---

## Task 5: Add offscreen message contracts

**Files:**
- Create: `src/contracts/offscreen-messages.ts`

Typed message shapes for traffic to the offscreen document. Kept separate from `RuntimeMessage` (popup→background) because offscreen traffic is background→offscreen and dispatched by `target`, not `topic`.

- [ ] **Step 1: Create the contracts file**

`src/contracts/offscreen-messages.ts`:

```ts
import type { Options as TurndownOptions } from 'turndown';

export const OFFSCREEN_CLIPBOARD_TARGET = 'offscreen-clipboard';
export const OFFSCREEN_MARKDOWN_TARGET = 'offscreen-markdown';

export interface OffscreenClipboardMessage {
  target: typeof OFFSCREEN_CLIPBOARD_TARGET;
  text: string;
}

export interface OffscreenMarkdownMessage {
  target: typeof OFFSCREEN_MARKDOWN_TARGET;
  html: string;
  options: TurndownOptions;
}

export type OffscreenMessage = OffscreenClipboardMessage | OffscreenMarkdownMessage;

export interface OffscreenClipboardResponse {
  ok: boolean;
  error?: string;
}

export interface OffscreenMarkdownResponse {
  ok: boolean;
  markdown?: string;
  error?: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: still failing only on the Task-4 `selectionToMarkdown` references; no NEW errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/contracts/offscreen-messages.ts
git commit -m "feat: add offscreen message contracts"
```

---

## Task 6: Generalize the offscreen document lifecycle

**Files:**
- Create: `src/services/offscreen-document-service.ts`
- Test: `test/services/offscreen-document-service.test.ts`

Extracts the create-once / reuse-inherited / race-tolerant lifecycle from `offscreen-clipboard-service.ts` into a reason-agnostic service that creates the single document with **both** reasons and exposes a generic `sendMessage`.

- [ ] **Step 1: Write the failing test**

`test/services/offscreen-document-service.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createOffscreenDocumentService, OFFSCREEN_DOCUMENT_URL } from '../../src/services/offscreen-document-service.js';

function makeApis(opts?: {
  createImpl?: () => Promise<void>;
  sendImpl?: () => Promise<unknown>;
  getContextsImpl?: () => Promise<unknown[]>;
}) {
  const createDocument = vi.fn(opts?.createImpl ?? (async () => undefined));
  const sendMessage = vi.fn(opts?.sendImpl ?? (async () => ({ ok: true })));
  const getContexts = vi.fn(opts?.getContextsImpl ?? (async () => []));
  return {
    offscreenAPI: { createDocument } as any,
    runtimeAPI: { sendMessage, getContexts } as any,
    createDocument,
    sendMessage,
    getContexts,
  };
}

describe('offscreenDocumentService', () => {
  it('creates the document once with both reasons and reuses it', async () => {
    const { offscreenAPI, runtimeAPI, createDocument, sendMessage } = makeApis();
    const service = createOffscreenDocumentService(offscreenAPI, runtimeAPI);

    await service.sendMessage({ a: 1 });
    await service.sendMessage({ b: 2 });

    expect(createDocument).toHaveBeenCalledTimes(1);
    expect(createDocument).toHaveBeenCalledWith(expect.objectContaining({
      url: OFFSCREEN_DOCUMENT_URL,
      reasons: ['CLIPBOARD', 'DOM_PARSER'],
    }));
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenLastCalledWith({ b: 2 });
  });

  it('de-dupes concurrent sends into a single createDocument', async () => {
    const { offscreenAPI, runtimeAPI, createDocument } = makeApis();
    const service = createOffscreenDocumentService(offscreenAPI, runtimeAPI);
    await Promise.all([service.sendMessage({ a: 1 }), service.sendMessage({ b: 2 })]);
    expect(createDocument).toHaveBeenCalledTimes(1);
  });

  it('reuses an inherited document instead of creating another', async () => {
    const { offscreenAPI, runtimeAPI, createDocument } = makeApis({
      getContextsImpl: async () => [{ contextType: 'OFFSCREEN_DOCUMENT' }],
    });
    const service = createOffscreenDocumentService(offscreenAPI, runtimeAPI);
    await service.sendMessage({ a: 1 });
    expect(createDocument).not.toHaveBeenCalled();
  });

  it('treats a create race as success when a document appears concurrently', async () => {
    let calls = 0;
    const { offscreenAPI, runtimeAPI } = makeApis({
      createImpl: async () => { throw new Error('Only a single offscreen document may be created'); },
      getContextsImpl: async () => (calls++ === 0 ? [] : [{ contextType: 'OFFSCREEN_DOCUMENT' }]),
    });
    const service = createOffscreenDocumentService(offscreenAPI, runtimeAPI);
    await expect(service.sendMessage({ a: 1 })).resolves.toEqual({ ok: true });
  });

  it('rethrows a genuine create failure and retries on the next send', async () => {
    let attempts = 0;
    const { offscreenAPI, runtimeAPI, createDocument } = makeApis({
      createImpl: async () => { attempts++; if (attempts === 1) throw new Error('boom'); },
      getContextsImpl: async () => [],
    });
    const service = createOffscreenDocumentService(offscreenAPI, runtimeAPI);
    await expect(service.sendMessage({ a: 1 })).rejects.toThrow('boom');
    await expect(service.sendMessage({ a: 1 })).resolves.toEqual({ ok: true });
    expect(createDocument).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project unit test/services/offscreen-document-service.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `offscreen-document-service.ts`**

`src/services/offscreen-document-service.ts`:

```ts
export interface OffscreenDocumentService {
  /** Ensure the offscreen document exists, then forward a message to it. */
  sendMessage: <T = unknown>(message: unknown) => Promise<T>;
}

export const OFFSCREEN_DOCUMENT_URL = 'dist/static/offscreen.html';

type OffscreenAPI = Pick<typeof chrome.offscreen, 'createDocument'>;
type RuntimeAPI = Pick<typeof chrome.runtime, 'sendMessage' | 'getContexts'>;

export function createOffscreenDocumentService(
  offscreenAPI: OffscreenAPI = chrome.offscreen,
  runtimeAPI: RuntimeAPI = chrome.runtime,
): OffscreenDocumentService {
  // Lazy keep-open singleton. `documentReady` is set once and reused; it is
  // reset only on a genuine creation failure so the next send can retry.
  let documentReady: Promise<void> | null = null;

  // Determine whether an offscreen document already exists via the structured
  // chrome.runtime.getContexts API (Chrome 116+) rather than matching the
  // English-only, version-specific createDocument error text.
  async function hasDocument(): Promise<boolean> {
    const contexts = await runtimeAPI.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
    });
    return contexts.length > 0;
  }

  async function createOnce(): Promise<void> {
    // A document may already exist — typically one created by a previous
    // service-worker lifetime that this fresh worker inherited. Reuse it
    // rather than creating a second (Chrome allows only one at a time).
    if (await hasDocument()) {
      return;
    }
    try {
      await offscreenAPI.createDocument({
        url: OFFSCREEN_DOCUMENT_URL,
        reasons: ['CLIPBOARD' as chrome.offscreen.Reason, 'DOM_PARSER' as chrome.offscreen.Reason],
        justification: 'Write Markdown to the clipboard and convert selection HTML to Markdown.',
      });
    } catch (error) {
      // If a document appeared between the check and the create (a race),
      // treat it as success; otherwise surface the real error. This keeps us
      // off any reliance on the createDocument error message string.
      if (!(await hasDocument())) {
        throw error;
      }
    }
  }

  async function ensureDocument(): Promise<void> {
    if (!documentReady) {
      documentReady = createOnce();
    }
    try {
      await documentReady;
    } catch (error) {
      documentReady = null;
      throw error;
    }
  }

  async function sendMessage<T = unknown>(message: unknown): Promise<T> {
    await ensureDocument();
    return await runtimeAPI.sendMessage(message) as T;
  }

  return { sendMessage };
}

export function createBrowserOffscreenDocumentService(): OffscreenDocumentService | null {
  if (typeof chrome === 'undefined' || !chrome.offscreen) {
    return null;
  }
  return createOffscreenDocumentService();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --project unit test/services/offscreen-document-service.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add src/services/offscreen-document-service.ts test/services/offscreen-document-service.test.ts
git commit -m "feat: add reason-agnostic offscreen document service"
```

---

## Task 7: Make the offscreen clipboard service delegate to the document service

**Files:**
- Modify: `src/services/offscreen-clipboard-service.ts`
- Modify: `test/services/offscreen-clipboard-service.test.ts`

The clipboard service keeps its `copy(text)` API and the `target: 'offscreen-clipboard'` message shape, but delegates all document lifecycle to an injected `OffscreenDocumentService`.

- [ ] **Step 1: Rewrite the test**

Replace the entire contents of `test/services/offscreen-clipboard-service.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createOffscreenClipboardService } from '../../src/services/offscreen-clipboard-service.js';
import { OFFSCREEN_CLIPBOARD_TARGET } from '../../src/contracts/offscreen-messages.js';
import type { OffscreenDocumentService } from '../../src/services/offscreen-document-service.js';

function makeDocService(sendImpl?: (m: unknown) => Promise<unknown>) {
  const sendMessage = vi.fn(sendImpl ?? (async () => ({ ok: true })));
  const service: OffscreenDocumentService = { sendMessage: sendMessage as any };
  return { service, sendMessage };
}

describe('offscreenClipboardService', () => {
  it('sends a clipboard-target message and resolves true on ok', async () => {
    const { service, sendMessage } = makeDocService();
    const clipboard = createOffscreenClipboardService(service);

    await expect(clipboard.copy('hello')).resolves.toBe(true);
    expect(sendMessage).toHaveBeenCalledWith({ target: OFFSCREEN_CLIPBOARD_TARGET, text: 'hello' });
  });

  it('throws when the offscreen document reports failure', async () => {
    const { service } = makeDocService(async () => ({ ok: false, error: 'execCommand returned false' }));
    const clipboard = createOffscreenClipboardService(service);

    await expect(clipboard.copy('x')).rejects.toThrow('offscreen clipboard write failed: execCommand returned false');
  });

  it('throws when there is no response', async () => {
    const { service } = makeDocService(async () => undefined);
    const clipboard = createOffscreenClipboardService(service);

    await expect(clipboard.copy('x')).rejects.toThrow('offscreen clipboard write failed: no response');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project unit test/services/offscreen-clipboard-service.test.ts`
Expected: FAIL — `createOffscreenClipboardService` still has the old signature / imports.

- [ ] **Step 3: Rewrite `offscreen-clipboard-service.ts`**

Replace the entire file contents:

```ts
import type { OffscreenDocumentService } from './offscreen-document-service.js';
import { createBrowserOffscreenDocumentService } from './offscreen-document-service.js';
import type { OffscreenClipboardResponse } from '../contracts/offscreen-messages.js';
import { OFFSCREEN_CLIPBOARD_TARGET } from '../contracts/offscreen-messages.js';

export interface OffscreenClipboardService {
  copy: (text: string) => Promise<boolean>;
}

export function createOffscreenClipboardService(
  documentService: OffscreenDocumentService,
): OffscreenClipboardService {
  async function copy(text: string): Promise<boolean> {
    const response = await documentService.sendMessage<OffscreenClipboardResponse | undefined>({
      target: OFFSCREEN_CLIPBOARD_TARGET,
      text,
    });
    if (!response?.ok) {
      throw new Error(`offscreen clipboard write failed: ${response?.error ?? 'no response'}`);
    }
    return true;
  }

  return { copy };
}

export function createBrowserOffscreenClipboardService(): OffscreenClipboardService | null {
  const documentService = createBrowserOffscreenDocumentService();
  if (!documentService) {
    return null;
  }
  return createOffscreenClipboardService(documentService);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --project unit test/services/offscreen-clipboard-service.test.ts`
Expected: PASS (all 3).

- [ ] **Step 5: Run the clipboard-service tests to check for breakage**

Run: `npx vitest run --project unit test/services/clipboard-service.test.ts`
Expected: still PASS — `clipboard-service.ts` is unchanged and `createBrowserOffscreenClipboardService()` keeps the same no-arg signature. (If it fails, that is handled in Task 8; do not pre-edit.)

- [ ] **Step 6: Commit**

```bash
git add src/services/offscreen-clipboard-service.ts test/services/offscreen-clipboard-service.test.ts
git commit -m "refactor: offscreen clipboard service delegates to document service"
```

---

## Task 8: Thread a shared offscreen document service through the clipboard controller

**Files:**
- Modify: `src/services/clipboard-service.ts`
- Modify: `test/services/clipboard-service.test.ts`

So that clipboard writes and Markdown conversion share **one** offscreen document, `background.ts` will construct a single `OffscreenDocumentService` and inject it. The clipboard controller/factory accepts it (or `null` on Firefox) instead of constructing its own.

- [ ] **Step 1: Read the existing clipboard-service test to learn the construction calls**

Run: `sed -n '1,80p' test/services/clipboard-service.test.ts`
Expected: note every call to `createClipboardService`, `createBrowserClipboardService`, and `createBrowserClipboardServiceController` and their current argument lists.

- [ ] **Step 2: Update `clipboard-service.ts` signatures**

In `src/services/clipboard-service.ts`:

Replace the import block at the top:

```ts
import type { ClipboardAPI } from './shared-types.js';
import type { OffscreenClipboardService } from './offscreen-clipboard-service.js';
import { createOffscreenClipboardService } from './offscreen-clipboard-service.js';
import type { OffscreenDocumentService } from './offscreen-document-service.js';
```

`createClipboardService` keeps its existing signature `(clipboardAPI, offscreenService)` and body — no change.

Replace `createBrowserClipboardService` (currently builds the offscreen service internally) with a version that receives the document service:

```ts
export function createBrowserClipboardService(
  clipboardAPI: ClipboardAPI | null,
  offscreenDocumentService: OffscreenDocumentService | null,
  mockMode = false,
): ClipboardService {
  if (mockMode) {
    return createMockClipboardService();
  }

  const offscreenService: OffscreenClipboardService | null = offscreenDocumentService
    ? createOffscreenClipboardService(offscreenDocumentService)
    : null;
  return createClipboardService(clipboardAPI, offscreenService);
}
```

In `createBrowserClipboardServiceController`, add the document service parameter and forward it. Change the signature and the two internal `createBrowserClipboardService` calls:

```ts
export function createBrowserClipboardServiceController(
  clipboardAPI: ClipboardAPI | null,
  offscreenDocumentService: OffscreenDocumentService | null,
  options?: {
    storageArea?: browser.storage.StorageArea;
    storageKey?: string;
    defaultMockState?: boolean;
  },
): ClipboardServiceController {
```

Inside it, update both construction sites:

```ts
  let activeService = createBrowserClipboardService(clipboardAPI, offscreenDocumentService, mockMode);
```

and inside `setMockMode`:

```ts
      activeService = createBrowserClipboardService(clipboardAPI, offscreenDocumentService, mockMode);
```

(Remove the now-unused `createBrowserOffscreenClipboardService` import if present.)

- [ ] **Step 3: Update the clipboard-service tests**

In `test/services/clipboard-service.test.ts`, update every `createBrowserClipboardService(api, mock)` call to `createBrowserClipboardService(api, null, mock)` and every `createBrowserClipboardServiceController(api, opts?)` call to `createBrowserClipboardServiceController(api, null, opts?)`. Add one test asserting the offscreen path is used when a document service is injected and `clipboardAPI` is null:

```ts
it('writes via the injected offscreen document service when there is no clipboard API', async () => {
  const sendMessage = vi.fn(async () => ({ ok: true }));
  const docService = { sendMessage } as any;
  const service = createBrowserClipboardService(null, docService, false);

  await expect(service.copy('hi')).resolves.toBe(true);
  expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ text: 'hi' }));
});
```

(Ensure `vi` is imported in that test file; it already is.)

- [ ] **Step 4: Run the clipboard tests**

Run: `npx vitest run --project unit test/services/clipboard-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/clipboard-service.ts test/services/clipboard-service.test.ts
git commit -m "refactor: inject shared offscreen document service into clipboard controller"
```

---

## Task 9: Add the MarkdownConverter abstraction

**Files:**
- Create: `src/services/markdown-converter.ts`
- Test: `test/services/markdown-converter.test.ts` (unit — offscreen converter)
- Test: `test/ui/markdown-converter-event-page.spec.ts` (browser — event-page converter, needs DOM)

`createEventPageMarkdownConverter().convert()` **dynamically** `import()`s `html-to-markdown.js` (memoized). Because the import is dynamic, `background.ts` can statically import this module without dragging Turndown into the Chrome service-worker graph.

- [ ] **Step 1: Write the failing unit test (offscreen converter)**

`test/services/markdown-converter.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createOffscreenMarkdownConverter } from '../../src/services/markdown-converter.js';
import { OFFSCREEN_MARKDOWN_TARGET } from '../../src/contracts/offscreen-messages.js';
import type { OffscreenDocumentService } from '../../src/services/offscreen-document-service.js';

const OPTS = { headingStyle: 'atx' as const };

describe('createOffscreenMarkdownConverter', () => {
  it('posts a markdown-target message and returns the markdown', async () => {
    const sendMessage = vi.fn(async () => ({ ok: true, markdown: '# Hi' }));
    const docService: OffscreenDocumentService = { sendMessage: sendMessage as any };
    const converter = createOffscreenMarkdownConverter(docService);

    await expect(converter.convert('<h1>Hi</h1>', OPTS)).resolves.toBe('# Hi');
    expect(sendMessage).toHaveBeenCalledWith({
      target: OFFSCREEN_MARKDOWN_TARGET,
      html: '<h1>Hi</h1>',
      options: OPTS,
    });
  });

  it('throws when the offscreen document reports failure', async () => {
    const sendMessage = vi.fn(async () => ({ ok: false, error: 'boom' }));
    const docService: OffscreenDocumentService = { sendMessage: sendMessage as any };
    const converter = createOffscreenMarkdownConverter(docService);

    await expect(converter.convert('<h1>Hi</h1>', OPTS)).rejects.toThrow('offscreen markdown conversion failed: boom');
  });
});
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `npx vitest run --project unit test/services/markdown-converter.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `markdown-converter.ts`**

`src/services/markdown-converter.ts`:

```ts
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
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `npx vitest run --project unit test/services/markdown-converter.test.ts`
Expected: PASS (both).

- [ ] **Step 5: Write the browser test (event-page converter)**

`test/ui/markdown-converter-event-page.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEventPageMarkdownConverter } from '../../src/services/markdown-converter.js';

describe('createEventPageMarkdownConverter', () => {
  it('converts HTML to Markdown in-page via the lazy import', async () => {
    const converter = createEventPageMarkdownConverter();
    await expect(converter.convert('<h1>Hi</h1><p>x</p>', { headingStyle: 'atx' }))
      .resolves.toBe('# Hi\n\nx');
  });
});
```

- [ ] **Step 6: Run the browser test to verify it passes**

Run: `npx vitest run --project browser test/ui/markdown-converter-event-page.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/markdown-converter.ts test/services/markdown-converter.test.ts test/ui/markdown-converter-event-page.spec.ts
git commit -m "feat: add MarkdownConverter (offscreen + event-page)"
```

---

## Task 10: Rewire the selection-converter service to extract HTML and inject the converter

**Files:**
- Modify: `src/services/selection-converter-service.ts`
- Modify: `test/services/selection-converter-service.test.ts`

The service now: runs `extractSelectionHtml(onlyIfFocused)` in the target frame(s), picks the single non-empty HTML string (focus heuristic already guarantees at most one), and converts it via the injected `MarkdownConverter`. The `turndownJsURL` / `gfmPluginURL` params are removed.

- [ ] **Step 1: Rewrite the test**

Replace the entire contents of `test/services/selection-converter-service.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createSelectionConverterService } from '../../src/services/selection-converter-service.js';
import type { ScriptingAPI } from '../../src/services/shared-types.js';
import type { TurndownOptionsProvider } from '../../src/services/selection-converter-service.js';
import type { MarkdownConverter } from '../../src/services/markdown-converter.js';
import type { Options as TurndownOptions } from 'turndown';
import { extractSelectionHtml } from '../../src/content-scripts/selection-to-markdown.js';

function makeTab(id: number | undefined): browser.tabs.Tab {
  return {
    id, index: 0, pinned: false, highlighted: false, windowId: 1,
    active: true, incognito: false, mutedInfo: { muted: false },
  } as browser.tabs.Tab;
}

function makeConverter(impl?: (html: string, opts: TurndownOptions) => Promise<string>) {
  const convert = vi.fn(impl ?? (async (html: string) => `MD(${html})`));
  const converter: MarkdownConverter = { convert };
  return { converter, convert };
}

describe('selectionConverterService', () => {
  it('extracts HTML in all frames with the focus filter, then converts the single non-empty frame', async () => {
    const executeScript = vi.fn(async () => [{ result: '' }, { result: '<h1>Hi</h1>' }, { result: '' }]);
    const scriptingAPI: ScriptingAPI = { executeScript };
    const turndownOptions: TurndownOptions = { headingStyle: 'atx', bulletListMarker: '-' };
    const provider: TurndownOptionsProvider = { getTurndownOptions: () => turndownOptions };
    const { converter, convert } = makeConverter(async () => '# Hi');

    const service = createSelectionConverterService(scriptingAPI, provider, converter);
    const result = await service.convertSelectionToMarkdown(makeTab(123));

    expect(result).toBe('# Hi');
    expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({
      target: { tabId: 123, allFrames: true },
      func: extractSelectionHtml,
      args: [true],
    }));
    expect(convert).toHaveBeenCalledWith('<h1>Hi</h1>', turndownOptions);
  });

  it('targets the given frame and disables the focus filter when a frameId is provided', async () => {
    const executeScript = vi.fn(async () => [{ result: '<p>x</p>' }]);
    const scriptingAPI: ScriptingAPI = { executeScript };
    const provider: TurndownOptionsProvider = { getTurndownOptions: () => ({ headingStyle: 'atx' }) };
    const { converter } = makeConverter(async () => 'x');

    const service = createSelectionConverterService(scriptingAPI, provider, converter);
    await service.convertSelectionToMarkdown(makeTab(555), 7);

    expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({
      target: { tabId: 555, frameIds: [7] },
      func: extractSelectionHtml,
      args: [false],
    }));
  });

  it('treats frameId 0 (main frame) as an explicit frame, not "no frame"', async () => {
    const executeScript = vi.fn(async () => [{ result: '<p>x</p>' }]);
    const scriptingAPI: ScriptingAPI = { executeScript };
    const provider: TurndownOptionsProvider = { getTurndownOptions: () => ({ headingStyle: 'atx' }) };
    const { converter } = makeConverter();

    const service = createSelectionConverterService(scriptingAPI, provider, converter);
    await service.convertSelectionToMarkdown(makeTab(556), 0);

    expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({
      target: { tabId: 556, frameIds: [0] },
      args: [false],
    }));
  });

  it('returns empty string and does not convert when no frame has a selection', async () => {
    const executeScript = vi.fn(async () => [{ result: '' }, { result: '' }]);
    const scriptingAPI: ScriptingAPI = { executeScript };
    const provider: TurndownOptionsProvider = { getTurndownOptions: () => ({ headingStyle: 'atx' }) };
    const { converter, convert } = makeConverter();

    const service = createSelectionConverterService(scriptingAPI, provider, converter);
    const result = await service.convertSelectionToMarkdown(makeTab(458));

    expect(result).toBe('');
    expect(convert).not.toHaveBeenCalled();
  });

  it('uses turndown options from the provider', async () => {
    const getTurndownOptions = vi.fn(() => ({ headingStyle: 'setext' as const, bulletListMarker: '*' as const }));
    const executeScript = vi.fn(async () => [{ result: '<p>x</p>' }]);
    const scriptingAPI: ScriptingAPI = { executeScript };
    const provider: TurndownOptionsProvider = { getTurndownOptions };
    const { converter, convert } = makeConverter();

    const service = createSelectionConverterService(scriptingAPI, provider, converter);
    await service.convertSelectionToMarkdown(makeTab(789));

    expect(getTurndownOptions).toHaveBeenCalledTimes(1);
    expect(convert).toHaveBeenCalledWith('<p>x</p>', { headingStyle: 'setext', bulletListMarker: '*' });
  });

  it('throws when the tab has no id', async () => {
    const scriptingAPI: ScriptingAPI = { executeScript: vi.fn().mockRejectedValue(new Error('nope')) };
    const provider: TurndownOptionsProvider = { getTurndownOptions: () => ({ headingStyle: 'atx' }) };
    const { converter } = makeConverter();

    const service = createSelectionConverterService(scriptingAPI, provider, converter);
    await expect(service.convertSelectionToMarkdown(makeTab(undefined))).rejects.toThrow('tab has no id');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project unit test/services/selection-converter-service.test.ts`
Expected: FAIL — `createSelectionConverterService` still has the URL-based signature; `extractSelectionHtml` import resolves (from Task 4) but the service does not use it.

- [ ] **Step 3: Rewrite `selection-converter-service.ts`**

Replace the entire file contents:

```ts
import type { Options as TurndownOptions } from 'turndown';
import type { ScriptingAPI } from './shared-types.js';
import type { MarkdownConverter } from './markdown-converter.js';
import { extractSelectionHtml } from '../content-scripts/selection-to-markdown.js';

export interface TurndownOptionsProvider {
  getTurndownOptions: () => TurndownOptions;
}

export interface SelectionConverterService {
  /**
   * Convert the current selection in a tab to Markdown.
   *
   * @param tab - The browser tab containing the selection
   * @param frameId - The frame the user interacted with (from contextMenus.OnClickData).
   *   When provided, only that frame is read. When omitted (keyboard shortcut), HTML is
   *   extracted from all frames and only the focused leaf frame contributes.
   * @returns The selection converted to Markdown for the single target frame
   */
  convertSelectionToMarkdown: (tab: browser.tabs.Tab, frameId?: number) => Promise<string>;
}

export function createSelectionConverterService(
  scriptingAPI: ScriptingAPI,
  turndownOptionsProvider: TurndownOptionsProvider,
  converter: MarkdownConverter,
): SelectionConverterService {
  async function convertSelectionToMarkdown(
    tab: browser.tabs.Tab,
    frameId?: number,
  ): Promise<string> {
    if (!tab.id) {
      throw new Error('tab has no id');
    }

    // Context menu gives a precise frameId (0 is the main frame). The keyboard shortcut
    // gives no frame, so we inject into all frames and let each frame self-filter via the
    // onlyIfFocused flag. NOTE: branch on `=== undefined`, not falsiness — frameId 0 is valid.
    const onlyIfFocused = frameId === undefined;
    const target = onlyIfFocused
      ? { tabId: tab.id, allFrames: true }
      : { tabId: tab.id, frameIds: [frameId] };

    // Selection extraction must run in the page (it depends on the live Selection and
    // base URL). Conversion runs out-of-page via the injected converter.
    const results = await scriptingAPI.executeScript({
      target,
      func: extractSelectionHtml,
      args: [onlyIfFocused],
    });

    // Exactly one frame should contribute HTML: either the explicitly targeted frame, or
    // (keyboard path) the single focused leaf frame. Find that one and convert only it.
    const html = results
      .map(frame => frame.result as string)
      .find(result => result !== undefined && result !== '');

    if (!html) {
      return '';
    }

    return await converter.convert(html, turndownOptionsProvider.getTurndownOptions());
  }

  return {
    convertSelectionToMarkdown,
  };
}

export function createBrowserSelectionConverterService(
  turndownOptionsProvider: TurndownOptionsProvider,
  converter: MarkdownConverter,
): SelectionConverterService {
  return createSelectionConverterService(
    browser.scripting,
    turndownOptionsProvider,
    converter,
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --project unit test/services/selection-converter-service.test.ts`
Expected: PASS (all 6).

- [ ] **Step 5: Commit**

```bash
git add src/services/selection-converter-service.ts test/services/selection-converter-service.test.ts
git commit -m "refactor: selection-converter extracts HTML and injects MarkdownConverter"
```

---

## Task 11: Route convert messages in the offscreen document

**Files:**
- Modify: `src/offscreen.ts`
- Modify: `test/offscreen.test.ts`

`offscreen.ts` keeps `copyTextToClipboard` and adds a convert handler that runs `htmlToMarkdown`. The single `onMessage` listener dispatches by `target`.

- [ ] **Step 1: Write the failing convert-handler test in the browser project**

The convert handler calls `htmlToMarkdown`, which needs a DOM, so this test must live in the **browser** project — do NOT add a DOM-dependent test to `test/offscreen.test.ts` (node project). Leave that file's existing clipboard tests untouched.

Create `test/ui/offscreen-convert.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { convertHtmlMessage } from '../../src/offscreen.js';
import { OFFSCREEN_MARKDOWN_TARGET } from '../../src/contracts/offscreen-messages.js';

describe('convertHtmlMessage', () => {
  it('converts HTML and returns markdown', () => {
    expect(convertHtmlMessage({
      target: OFFSCREEN_MARKDOWN_TARGET,
      html: '<h1>Hi</h1>',
      options: { headingStyle: 'atx' },
    })).toEqual({ ok: true, markdown: '# Hi' });
  });

  it('returns an error when conversion throws', () => {
    const result = convertHtmlMessage({
      target: OFFSCREEN_MARKDOWN_TARGET,
      // @ts-expect-error force a throw
      html: null,
      options: { headingStyle: 'atx' },
    });
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe('string');
  });
});
```

- [ ] **Step 2: Run the new browser test to verify it fails**

Run: `npx vitest run --project browser test/ui/offscreen-convert.spec.ts`
Expected: FAIL — `convertHtmlMessage` is not exported from `offscreen.ts`.

- [ ] **Step 3: Rewrite `offscreen.ts`**

Replace the entire file contents:

```ts
import { htmlToMarkdown } from './lib/html-to-markdown.js';
import {
  OFFSCREEN_CLIPBOARD_TARGET,
  OFFSCREEN_MARKDOWN_TARGET,
} from './contracts/offscreen-messages.js';
import type {
  OffscreenClipboardMessage,
  OffscreenClipboardResponse,
  OffscreenMarkdownMessage,
  OffscreenMarkdownResponse,
  OffscreenMessage,
} from './contracts/offscreen-messages.js';

/**
 * Write text to the clipboard from inside the offscreen (extension-origin)
 * document. Uses execCommand because an offscreen document is never focused
 * (navigator.clipboard.writeText would reject), but execCommand in an
 * extension-origin document holding the clipboardWrite permission is allowed.
 */
export function copyTextToClipboard(text: string): OffscreenClipboardResponse {
  const textarea = document.getElementById('clipboard') as HTMLTextAreaElement | null;
  if (!textarea) {
    return { ok: false, error: 'missing #clipboard textarea' };
  }
  try {
    textarea.value = text;
    textarea.select();
    const ok = document.execCommand('copy');
    return ok ? { ok: true } : { ok: false, error: 'execCommand returned false' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `${error.name} ${error.message}` : String(error) };
  } finally {
    textarea.value = '';
  }
}

/** Convert selection HTML to Markdown inside the offscreen document's DOM. */
export function convertHtmlMessage(message: OffscreenMarkdownMessage): OffscreenMarkdownResponse {
  try {
    return { ok: true, markdown: htmlToMarkdown(message.html, message.options) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `${error.name} ${error.message}` : String(error) };
  }
}

// Registered only in the extension runtime; guarded so unit tests (no `chrome`)
// can import this module and test the handlers in isolation.
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message: OffscreenMessage, _sender, sendResponse) => {
    if (!message || typeof (message as { target?: unknown }).target !== 'string') {
      return undefined;
    }
    if (message.target === OFFSCREEN_CLIPBOARD_TARGET) {
      sendResponse(copyTextToClipboard((message as OffscreenClipboardMessage).text ?? ''));
      return undefined;
    }
    if (message.target === OFFSCREEN_MARKDOWN_TARGET) {
      sendResponse(convertHtmlMessage(message as OffscreenMarkdownMessage));
      return undefined;
    }
    return undefined;
  });
}
```

- [ ] **Step 4: Run the new browser test to verify it passes**

Run: `npx vitest run --project browser test/ui/offscreen-convert.spec.ts`
Expected: PASS (both).

- [ ] **Step 5: Run the existing offscreen unit test to confirm no regression**

Run: `npx vitest run --project unit test/offscreen.test.ts`
Expected: PASS (the 3 existing clipboard tests).

- [ ] **Step 6: Commit**

```bash
git add src/offscreen.ts test/ui/offscreen-convert.spec.ts
git commit -m "feat: offscreen document converts HTML to Markdown"
```

---

## Task 12: Wire everything in `background.ts`

**Files:**
- Modify: `src/background.ts`

The composition root selects implementations by flag and injects them. One `OffscreenDocumentService` is shared by clipboard writes and the converter (Chrome); on Firefox both are `null` / Event Page.

- [ ] **Step 1: Update imports**

In `src/background.ts`, update the relevant import lines:

```ts
import { createBrowserClipboardServiceController } from './services/clipboard-service.js';
import { createBrowserSelectionConverterService } from './services/selection-converter-service.js';
import { createBrowserOffscreenDocumentService } from './services/offscreen-document-service.js';
import {
  createOffscreenMarkdownConverter,
  createEventPageMarkdownConverter,
} from './services/markdown-converter.js';
import type { MarkdownConverter } from './services/markdown-converter.js';
```

- [ ] **Step 2: Build the shared offscreen document service and converter, wire the clipboard controller**

Replace the clipboard/selection wiring block (the current lines that compute `useNavigatorClipboard`, build `clipboardService`, and build `selectionConverterService`) with:

```ts
// Check if ALWAYS_USE_NAVIGATOR_COPY_API flag is set
const useNavigatorClipboard = Flags.alwaysUseNavigatorClipboard();
const convertMarkdownInBackground = Flags.convertMarkdownInBackground();
const pendingPopupFeedbackService = createBrowserPendingPopupFeedbackService();
const EMPTY_RESULT_FEEDBACK: PendingPopupFeedbackCode = 'empty-result';

// Chrome shares ONE offscreen document between clipboard writes and Markdown
// conversion. Firefox has no offscreen API (it uses navigator.clipboard and the
// Event Page), so this is null there.
const offscreenDocumentService = convertMarkdownInBackground
  ? null
  : createBrowserOffscreenDocumentService();

const clipboardService = createBrowserClipboardServiceController(
  useNavigatorClipboard ? navigator.clipboard : null,
  offscreenDocumentService,
);

(globalThis as any).setMockClipboardMode = clipboardService.setMockMode;

clipboardService.initializeMockState()
  .catch(error => console.error('Mock clipboard init error', error));

const markdownConverter: MarkdownConverter = convertMarkdownInBackground
  ? createEventPageMarkdownConverter()
  : createOffscreenMarkdownConverter(offscreenDocumentService!);

const selectionConverterService = createBrowserSelectionConverterService(
  {
    getTurndownOptions: () => ({
      headingStyle: 'atx',
      bulletListMarker: markdownInstance.unorderedListChar,
      codeBlockStyle: selectionCodeBlockStyle,
    }),
  },
  markdownConverter,
);
```

> The `offscreenDocumentService!` non-null assertion is correct: when `convertMarkdownInBackground` is false (Chrome), `createBrowserOffscreenDocumentService()` returns a service (Chrome has `chrome.offscreen`). If you prefer no assertion, guard with an explicit `if (!offscreenDocumentService) throw new Error('offscreen document service unavailable')` before constructing the converter.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (All `selectionToMarkdown` / old-signature references are now gone.)

- [ ] **Step 4: Commit**

```bash
git add src/background.ts
git commit -m "feat: wire offscreen document service and markdown converter by flag"
```

---

## Task 13: Update the browser-project selection specs

**Files:**
- Modify: `test/ui/selection-list-paragraph.spec.ts`
- Modify: `test/ui/selection-code-block.spec.ts`
- Modify: `test/ui/selection-trailing-newlines.spec.ts`
- Modify: `test/ui/selection-focus-frame.spec.ts`

These specs validated the full page-side pipeline. Recompose them as `htmlToMarkdown(extractSelectionHtml(onlyIfFocused), options)` so the DOM-dependent conversion stays covered with identical expected output.

- [ ] **Step 1: Update the helper in each list/code/trailing spec**

In all three files, change the top import from `selectionToMarkdown` to the two new functions:

```ts
import { extractSelectionHtml } from '../../src/content-scripts/selection-to-markdown.js';
import { htmlToMarkdown } from '../../src/lib/html-to-markdown.js';
```

Then, in each file's local `convertSelectionToMarkdown` helper, replace the `await selectionToMarkdown(...)` call (it passes the two `/src/vendor/...` URLs, an options object, and `false`) with a compose of extract + convert, keeping every other line of the helper (selection setup and the `finally` cleanup) exactly as-is. The options object differs per file — use the one already present in that file:

- `selection-list-paragraph.spec.ts` — the call passes inline `{ headingStyle: 'atx', bulletListMarker: '-' }`:
  ```ts
      return htmlToMarkdown(extractSelectionHtml(false), {
        headingStyle: 'atx',
        bulletListMarker: '-',
      });
  ```
- `selection-trailing-newlines.spec.ts` — same inline options as above:
  ```ts
      return htmlToMarkdown(extractSelectionHtml(false), {
        headingStyle: 'atx',
        bulletListMarker: '-',
      });
  ```
- `selection-code-block.spec.ts` — the helper merges `{ ...baseTurndownOptions, ...options }` and selects `selectionSelector`. Keep `baseTurndownOptions`, the `options?: Partial<TurndownOptions>` and `selectionSelector` params, and the `range.selectNodeContents(target)` setup; only swap the conversion line:
  ```ts
      return htmlToMarkdown(extractSelectionHtml(false), { ...baseTurndownOptions, ...options });
  ```

`extractSelectionHtml` and `htmlToMarkdown` are synchronous; you may drop `async`/`await` from the helper, but leaving them is harmless. Remove any now-unused `/src/vendor/...` URL string literals or `TURNDOWN`/`GFM` constants.

- [ ] **Step 2: Update `selection-focus-frame.spec.ts`**

This spec specifically tests the `onlyIfFocused` heuristic, which now lives entirely in `extractSelectionHtml`. Replace its imports/constants:

```ts
import { extractSelectionHtml } from '../../src/content-scripts/selection-to-markdown.js';
import { htmlToMarkdown } from '../../src/lib/html-to-markdown.js';

const OPTS = { headingStyle: 'atx' as const, bulletListMarker: '-' as const };
```

Replace each `await selectionToMarkdown(TURNDOWN, GFM, OPTS, <bool>)` with `htmlToMarkdown(extractSelectionHtml(<bool>), OPTS)`. The empty-string cases become `htmlToMarkdown(extractSelectionHtml(true), OPTS)` → `''` (note: `htmlToMarkdown('', OPTS)` returns `''`, so this still holds). Expected outputs are unchanged (`'# Hello'` and `''`).

- [ ] **Step 3: Run the updated browser specs**

Run: `npx vitest run --project browser test/ui/selection-list-paragraph.spec.ts test/ui/selection-code-block.spec.ts test/ui/selection-trailing-newlines.spec.ts test/ui/selection-focus-frame.spec.ts`
Expected: PASS — same expected strings as before the refactor.

- [ ] **Step 4: Commit**

```bash
git add test/ui/selection-list-paragraph.spec.ts test/ui/selection-code-block.spec.ts test/ui/selection-trailing-newlines.spec.ts test/ui/selection-focus-frame.spec.ts
git commit -m "test: recompose selection browser specs onto extract + htmlToMarkdown"
```

---

## Task 14: Remove Turndown from `web_accessible_resources`

**Files:**
- Modify: `chrome/manifest.json`
- Modify: `firefox-mv3/manifest.json`

Pages no longer dynamically import the vendored modules, so they should not be web-accessible.

- [ ] **Step 1: Inspect the current blocks**

Run: `grep -n -A12 "web_accessible_resources" chrome/manifest.json firefox-mv3/manifest.json`
Expected: each file has a `web_accessible_resources` array whose single entry lists `dist/vendor/turndown.mjs` and `dist/vendor/turndown-plugin-gfm.mjs` matched against `<all_urls>`.

- [ ] **Step 2: Remove the entries**

In **both** `chrome/manifest.json` and `firefox-mv3/manifest.json`, delete the entire `web_accessible_resources` key and its value (the array contains only the Turndown entry). Ensure the surrounding JSON stays valid (remove the trailing comma on the preceding property if needed).

> If a target later needs other web-accessible resources, this key can return; right now removing it entirely is correct.

- [ ] **Step 3: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('chrome/manifest.json','utf8')); JSON.parse(require('fs').readFileSync('firefox-mv3/manifest.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 4: Confirm `offscreen` permission still present (Chrome)**

Run: `grep -n "offscreen" chrome/manifest.json`
Expected: the `"offscreen"` permission line is still there (only `web_accessible_resources` was removed).

- [ ] **Step 5: Commit**

```bash
git add chrome/manifest.json firefox-mv3/manifest.json
git commit -m "chore: drop Turndown from web_accessible_resources"
```

---

## Task 15: Full verification + builds

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors. (If the flat config flags the new files, run `npm run lint:fix` and re-run; review any auto-fixes.)

- [ ] **Step 3: Full unit + browser test run**

Run: `npm test`
Expected: all tests pass across both `unit` and `browser` projects, including the rewritten `selection-converter-service`, `offscreen-document-service`, `offscreen-clipboard-service`, `clipboard-service`, `markdown-converter`, `html-to-markdown`, the offscreen convert spec, and the selection browser specs.

- [ ] **Step 4: Compile both targets**

Run: `npm run compile`
Expected: success. Then confirm the shims and vendor modules landed and Turndown is NOT statically reachable from the service worker:

Run: `ls chrome/dist/shims chrome/dist/lib/html-to-markdown.js chrome/dist/vendor/turndown.mjs && grep -rl "turndown" chrome/dist/background.js || echo "background.js has no static turndown reference (expected)"`
Expected: the shim/lib/vendor files exist; `background.js` contains no static `turndown` import (the grep prints the "expected" message).

- [ ] **Step 5: e2e (Chrome)**

Run: `npm run test:e2e -- selection-as-markdown`
Expected: the Chrome selection e2e passes end-to-end through the offscreen-document conversion path. (If the harness requires running the whole suite, run `npm run test:e2e`.)

- [ ] **Step 6: Manual smoke (record evidence)**

Per `superpowers:verification-before-completion`, load the unpacked `chrome/` build, select rich content on a page, trigger "Copy selection as Markdown" via both context menu and keyboard shortcut, and paste to confirm correct Markdown. Repeat the keyboard path inside an iframe to confirm the focused-leaf-frame behavior. Note the results in the completion summary.

- [ ] **Step 7: Final commit (if any verification fixups were needed)**

```bash
git add -A
git commit -m "test: verification fixups for offscreen markdown conversion"
```

---

## Self-Review Notes (for the executor)

- **Mid-refactor red builds are expected and called out** at the end of Task 4 (and resolved by Tasks 10/12/13). Do not paper over them by re-adding `selectionToMarkdown`.
- **Behavior preservation checklist** (verify against Task 10 + Task 13): single-frame result (no joining), focus heuristic in-page, trailing-newline trim, `frameId === undefined` semantics.
- **Type consistency:** `MarkdownConverter.convert(html, options)`, `OffscreenDocumentService.sendMessage(message)`, `extractSelectionHtml(onlyIfFocused)`, `htmlToMarkdown(html, options)`, contracts `OFFSCREEN_CLIPBOARD_TARGET` / `OFFSCREEN_MARKDOWN_TARGET` are used identically across every task.
- **Service-worker safety:** only `html-to-markdown.ts` and the two shims statically import Turndown; `markdown-converter.ts` imports `html-to-markdown` only via dynamic `import()`. Task 15 Step 4 verifies this empirically.
```
