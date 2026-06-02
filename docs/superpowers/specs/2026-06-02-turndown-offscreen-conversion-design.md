# Move Turndown.js execution out of page contexts

Issue: [#259](https://github.com/yorkxin/copy-as-markdown/issues/259) — "Chrome: move Turndown.js execution to offscreen document"
Date: 2026-06-02
Scope: Chrome (MV3 service worker) **and** Firefox (MV3 Event Page)

## Problem

Selection → Markdown conversion currently runs Turndown.js **inside the web page**. `selection-converter-service.ts` calls `chrome.scripting.executeScript({ allFrames: true, func: selectionToMarkdown, ... })`, and `selectionToMarkdown` dynamically `import()`s the vendored `turndown.mjs` + GFM plugin (exposed as `web_accessible_resources`) in each frame's content-script context, then runs the conversion there.

This is brittle:

- It relies on dynamically importing web-accessible modules into arbitrary pages, subject to page CSP.
- It loads a large library into every frame of the target page.
- It exposes the vendored modules to all origins via `web_accessible_resources`.

#257 already moved clipboard writing into a Chrome **offscreen document** (an extension-origin DOM context). Turndown needs a DOM too, so it belongs in the same place. The issue asks that a **single** offscreen document serve both clipboard writing and Turndown conversion (Chrome allows only one offscreen document at a time). On Firefox MV3 there is no offscreen API, but the background runs in an **Event Page that has a DOM**, so Turndown can run directly in the background there.

## Key constraints

1. **Selection extraction must stay in the page.** Cloning the live `Selection` and absolutizing `a[href]`/`img[src]` depends on the frame's document and base URL. Only the Turndown step moves.
2. **The Chrome background is a service worker with no `document`.** It must never load Turndown (Turndown requires a DOM). Both targets compile from the same `background.ts`, so the Turndown-importing module must be kept out of the service worker's static import graph.
3. **Only one offscreen document may exist.** Clipboard and conversion must share it, created once with both reasons.

## Design

### Two-phase split

`selectionToMarkdown` is split into an extraction phase (page) and a conversion phase (extension DOM context).

| Phase | Runs in | Unit |
|---|---|---|
| Extract | page frame, via `executeScript({ allFrames: true })` | `extractSelectionHtml(): string` |
| Convert | extension DOM context (offscreen doc on Chrome / Event Page on Firefox) | `htmlToMarkdown(html, options): string` |

- **`extractSelectionHtml()`** (in `src/content-scripts/selection-to-markdown.ts`): clones the selection ranges into a detached container, absolutizes `a[href]` and `img[src]`, normalizes wrapped `<pre>` blocks (the existing logic, all option-independent), and returns `container.innerHTML`. Returns `''` when there is no selection. No Turndown.
- **`htmlToMarkdown(html, options)`** (new `src/lib/html-to-markdown.ts`): builds the `TurndownService` (with `.remove('script')`, `.remove('style')`, the GFM tables plugin, and the `singleParagraphInListItem` rule), runs `.turndown(html)`, and trims trailing newlines — the existing conversion logic, unchanged. Statically imports the Turndown shim. This module requires a DOM.

`codeBlockStyle`, `headingStyle`, and `bulletListMarker` are Turndown options applied during conversion; they are not needed for extraction.

### MarkdownConverter abstraction (composition-root injection)

Mirrors the existing `ClipboardService` Firefox/Chrome split. The **composition root (`background.ts`) selects and injects the implementation via a flag**; neither the implementation nor the selection-converter service performs runtime capability checks.

```ts
interface MarkdownConverter {
  convert(html: string, options: TurndownOptions): Promise<string>;
}
```

- **`createOffscreenMarkdownConverter(offscreenDocumentService)`** (Chrome): posts `{ html, options }` to the shared offscreen document and awaits the markdown reply. Imports no DOM/Turndown code.
- **`createEventPageMarkdownConverter()`** (Firefox): `convert()` **lazily** `import()`s `html-to-markdown` (memoized) and runs it in-place in the Event Page. The lazy import is a resource-loading detail of this backend (analogous to the offscreen service lazily creating its document), and — critically — it keeps `html-to-markdown` (and therefore Turndown) out of `background.ts`'s static import graph, so the Chrome service worker never loads Turndown even though it statically imports this module.

There is **no** self-detecting `createBrowserMarkdownConverter()` factory.

### Backend selection flag

Follows the established `Flags` + `firefox-mv3/hacks.js` pattern used for the clipboard split, but with a **new, purpose-named flag** — `ALWAYS_USE_NAVIGATOR_COPY_API` is deliberately not reused, because "how to write the clipboard" and "where to run Turndown" must stay independent even though both happen to diverge along the Chrome/Firefox line today.

- `firefox-mv3/hacks.js`: add `globalThis.CONVERT_MARKDOWN_IN_BACKGROUND = true;`
- `src/config/flags.ts`: add `convertMarkdownInBackground: () => getBooleanFlag('CONVERT_MARKDOWN_IN_BACKGROUND')`
- `src/background.ts`:
  ```ts
  const markdownConverter = Flags.convertMarkdownInBackground()
    ? createEventPageMarkdownConverter()
    : createOffscreenMarkdownConverter(offscreenDocumentService);
  ```

### Unified offscreen document

Generalize `offscreen-clipboard-service.ts` into a shared `src/services/offscreen-document-service.ts` that owns the single-document lifecycle:

- `ensureDocument()`: create-once with reasons `['CLIPBOARD', 'DOM_PARSER']`, reusing an inherited document via `chrome.runtime.getContexts` and tolerating the create/exists race (preserving #257's behavior).
- `sendMessage(message)`: ensure the document, then `chrome.runtime.sendMessage` to it.

Both the clipboard write path and `OffscreenMarkdownConverter` depend on this one service, so only one offscreen document is ever created. Clipboard-specific message shaping (the `copy` wrapper) moves into the clipboard service, which now delegates document management to the shared service.

### offscreen.ts message routing

`offscreen.ts` dispatches on the message's target/topic:

- existing clipboard-write handler (textarea + `execCommand`), unchanged in behavior;
- new convert handler: `htmlToMarkdown(html, options)` → reply `{ ok: true, markdown }` (or `{ ok: false, error }`).

Message shapes are declared in `src/contracts/messages.ts` alongside the existing contracts. Turndown is statically imported here (this is a DOM context, only ever loaded in the offscreen document).

### selection-converter-service orchestration

`createSelectionConverterService(scriptingAPI, turndownOptionsProvider, converter)`:

1. `executeScript({ target: { tabId, allFrames: true }, func: extractSelectionHtml })` → per-frame HTML strings.
2. Drop empty HTML (blank iframes).
3. `await converter.convert(html, options)` for each remaining frame.
4. Drop empty markdown and join with `\n\n`.

The `turndownJsURL` / `gfmPluginURL` constructor parameters are removed (the page no longer loads Turndown); the converter is injected instead.

### Manifest cleanup

Remove the two Turndown entries from `web_accessible_resources` in **both** `chrome/manifest.json` and `firefox-mv3/manifest.json` — pages no longer import them. (`offscreen` permission stays on Chrome; offscreen reasons are passed in code, not the manifest.)

### Vendor shim

Add `src/shims/turndown.js` (re-export `../vendor/turndown.mjs`) and `src/shims/turndown.d.ts` (`export * from 'turndown'; export { default } from 'turndown';`), mirroring the `mustache` shim, so `html-to-markdown.ts` can statically import the vendored module with types. The GFM plugin is imported the same way (shim or direct typed import, matching whatever the GFM types require).

## Data flow

**Chrome:** trigger → `selection-converter-service` → `executeScript` extracts per-frame HTML → `OffscreenMarkdownConverter` → shared offscreen document runs `htmlToMarkdown` → markdown → joined → clipboard write (same document).

**Firefox:** identical until conversion, where `EventPageMarkdownConverter` runs `htmlToMarkdown` in the Event Page directly; clipboard write uses `navigator.clipboard` (unchanged).

## Testing

- **`selection-converter-service.test.ts`** (rewrite): `executeScript` now returns HTML strings; assert empty-filtering and `\n\n` join using a mocked `MarkdownConverter`; assert `convert` receives the provider's options.
- **`offscreen-document-service.test.ts`** (new): single create-once, both reasons, inherited-document reuse, create/exists race tolerance.
- **`markdown-converter-service.test.ts`** (new): offscreen converter posts the correct message and returns the reply; event-page converter (browser project — has DOM) returns real markdown via the lazy import.
- **`offscreen.test.ts`**: add convert-handler tests (success + error), keep clipboard tests.
- **Browser project** (`selection-code-block.spec.ts`, `selection-list-paragraph.spec.ts`, `selection-trailing-newlines.spec.ts`): repoint to compose `extractSelectionHtml()` + `htmlToMarkdown()`, preserving identical expected output so DOM-dependent conversion stays covered.
- **e2e** (`selection-as-markdown.spec.ts`): unchanged black-box; must still pass on Chrome.

## Verification item for implementation

Confirm whether `vendor/turndown.mjs` references `document`/`window` at module top level. Lazy import on the Firefox backend is used regardless, but this confirms the service worker can safely statically import `event-page-markdown-converter.ts`.

## Out of scope

- Changing the Markdown output for any input (behavior-preserving refactor).
- Tab/link export paths (`tab-export-service`, `link-export-service`) — they do not use Turndown.
- Firefox e2e in CI (already disabled for unrelated reasons).
