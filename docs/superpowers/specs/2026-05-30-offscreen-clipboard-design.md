# Offscreen Clipboard Write — Design

**Date:** 2026-05-30
**Status:** Approved (pending spec review)
**Base branch:** `master`. This work is implemented on a fresh branch cut from `master`
(it does not depend on, and should not be based on, any other in-flight branch).
**Related:** Regression introduced by commit `e90ed05` (reordered the clipboard fallbacks
so the unfocused iframe path runs before — and masks — the focused on-page-textarea path).

## Problem

"Copy Selection as Markdown" intermittently fails to write to the clipboard on
Chrome/Edge — silently, with the action reporting success. The root cause:

- On Chrome the clipboard **write** runs inside a content script injected into the page.
  The top-frame Async Clipboard path is permission-gated off (a content script runs in the
  *page's* origin, where the extension's permissions do not apply), so every write falls
  through to `document.execCommand('copy')` inside a hidden, **never-focused** iframe.
- `execCommand('copy')` in an unfocused page sub-frame returns `true` while silently not
  writing, depending on the tab's focus/activation state. Focus-managing SPAs (e.g. GitHub
  after a tab switch) reliably trigger the silent no-op.

Chrome MV3's background is a true **service worker** (no DOM, no focus), so
`navigator.clipboard.writeText` can't run there — which is why the page/iframe hack
existed. Firefox's MV3 background is an **event-page-style** context where
`navigator.clipboard` works, so Firefox already writes from the background (via the
`ALWAYS_USE_NAVIGATOR_COPY_API` flag set in `hacks.js`) and never uses the content script.

## Goal

Replace the page-injected clipboard write on Chrome with the officially documented MV3
mechanism — an **offscreen document** — which runs in an extension-origin context where
`clipboardWrite` applies and the write is independent of the web page's focus, CSP, or
event handlers. Remove the now-unnecessary clipboard content script, iframe, and
on-page-textarea hacks entirely.

## Decisions

| Decision | Choice |
| --- | --- |
| Chrome clipboard write | Offscreen document (`chrome.offscreen`, reason `CLIPBOARD`). |
| Firefox clipboard write | Unchanged — background `navigator.clipboard.writeText` via the existing `ALWAYS_USE_NAVIGATOR_COPY_API` flag. |
| Minimum Chrome version | **109+** (offscreen API). Set `minimum_chrome_version`. No older-Chrome fallback. |
| Offscreen lifecycle | **Create-and-close per copy (serialized)** — create the document on demand, use it for a single write, then close it immediately. Copies are serialized so only one document ever exists at a time. |
| Old hacks | **Full removal** — delete `content-script.ts`, `iframe-copy.ts`, `iframe-copy.html`, the on-page-textarea path, and the iframe `web_accessible_resources` entry. |
| Firefox mv3 | Unchanged and keeps working (flag/navigator path already active at init); the **selection** content script is untouched. |
| Firefox mv2 | **Out of scope, not modified.** Will lose clipboard when `content-script.ts` is deleted; accepted (folder to be deleted separately). |

## Non-goals

- No change to the selection-to-markdown conversion path (`executeScript` of
  `selection-to-markdown.ts` stays for both browsers).
- No keep-open / pooled offscreen document — it is created and closed per copy.
- No fallback clipboard path on Chrome (M109+ is required).
- No change to Firefox's clipboard mechanism.

## Browser asymmetry (why the branch exists)

| | Background context | Clipboard write |
| --- | --- | --- |
| Chrome/Edge | Service worker (no DOM) | Offscreen document → `execCommand('copy')` |
| Firefox mv2/mv3 | Event-page background (has DOM) | `navigator.clipboard.writeText` directly |

The offscreen document deliberately uses `execCommand('copy')` on a `<textarea>`, **not**
`navigator.clipboard.writeText`: an offscreen document is never "focused", so the Async
Clipboard API would reject there too. But `execCommand('copy')` in an **extension-origin**
document holding `clipboardWrite` is permitted unconditionally — that is the exact
difference from the page sub-frame, and the reason this is reliable.

## Architecture

The clipboard **write** is selected by capability inside the real clipboard service; the
mock-toggle controller (`createBrowserClipboardServiceController`, used by e2e) stays on
top unchanged. `clipboardService.copy(text, tab?)` keeps its existing signature.

```
clipboardService.copy(text, tab?)
  ├─ clipboardAPI present (Firefox)  → await clipboardAPI.writeText(text)
  └─ else (Chrome)                   → await offscreenClipboardService.copy(text)
```

`copyUsingContentScript`, the `content-script.ts` import, and the now-unused
`scriptingAPI` / `tabsAPI` / `iframeUrl` parameters are removed from the clipboard
service. The `tab` argument remains on `copy()` (the mock records it; the real paths
ignore it) to minimize churn.

### Components

1. **`src/static/offscreen.html`** — a minimal extension page containing a single
   `<textarea id="clipboard">` and a `<script type="module" src="../offscreen.js">`.

2. **`src/offscreen.ts`** → `dist/offscreen.js` — a `chrome.runtime.onMessage` listener.
   For messages targeted at the offscreen clipboard (matched by a `target` field), it
   sets the textarea value, selects it, runs `document.execCommand('copy')`, clears the
   textarea, and replies `{ ok: boolean; error?: string }`. Ignores all other messages.

3. **`src/services/offscreen-clipboard-service.ts`** — owns the offscreen lifecycle and
   the round-trip:
   - `copy(text)`: serialized through an in-memory promise chain so only one document
     exists at a time. Each call creates the document, sends
     `{ target: 'offscreen-clipboard', text }` via `chrome.runtime.sendMessage`, awaits the
     `{ ok, error }` reply, and then **closes the document** (in a `finally`, even on write
     failure). Creation treats `createDocument`'s "Only a single offscreen document may be
     created" error as "reuse a leftover document" (covers a failed prior close or a doc
     orphaned by a previous service-worker lifetime) — so it works on 109+ without depending
     on `chrome.runtime.getContexts`, which is 116+.

### Data flow (Chrome, one copy)

```
contextMenus.onClicked / commands.onCommand (background SW)
  → convertSelectionToMarkdown(tab)          // unchanged: executeScript selection
  → clipboardService.copy(text, tab)
      → offscreenClipboardService.copy(text)   // serialized
          → createDocument()                   // create on demand
          → runtime.sendMessage({ target:'offscreen-clipboard', text })
          → offscreen.js: textarea.value=text; select(); execCommand('copy'); reply { ok }
          → closeDocument()                    // close immediately (finally)
      ← ok
  → badge update (unchanged)
```

## Manifest changes

- **`chrome/manifest.json`**
  - Add `"clipboardWrite"` to `permissions` (required by the offscreen `execCommand`).
  - Add `"offscreen"` to `permissions`.
  - Add `"minimum_chrome_version": "109"`.
  - Remove `dist/static/iframe-copy.html` from `web_accessible_resources` (keep the
    turndown resources). `offscreen.html` does **not** need a `web_accessible_resources`
    entry — it is loaded by the offscreen API, not embedded in a page.
- **`firefox-mv3/manifest.json`**
  - Remove `dist/static/iframe-copy.html` from `web_accessible_resources`.
  - No `offscreen` permission (Firefox has no such API). `hacks.js` already loads before
    `dist/background.js`, so the navigator flag path is active at init — no ordering change
    needed.
- **`firefox-mv2/` — intentionally untouched (out of scope).** mv2's `background.html`
  loads `hacks.js` *after* `background.js`, so `ALWAYS_USE_NAVIGATOR_COPY_API` is unset
  when the clipboard service is constructed and mv2 currently copies through the content
  script. Deleting `content-script.ts` will therefore break mv2's clipboard. This is
  **accepted**: firefox-mv3 is the shipping build, and the firefox-mv2 folder will be
  deleted in separate work. Do not modify anything under `firefox-mv2/`.

(Note: `clipboardWrite` and `offscreen` produce **no user-facing permission warning**, so
existing Chrome users are not disabled pending review.)

## Removal list

- Delete `src/content-script.ts` (the clipboard `copy()` — **not** the selection content
  script `src/content-scripts/selection-to-markdown.ts`, which stays).
- Delete `src/iframe-copy.ts` and `src/static/iframe-copy.html`.
- Remove from `src/services/clipboard-service.ts`: `import copy`, `copyUsingContentScript`,
  and the `scriptingAPI` / `tabsAPI` / `iframeUrl` wiring used only by it; route the
  non-`clipboardAPI` (Chrome) branch to the offscreen service.
- Remove `iframeCopyUrl` construction and wiring in `src/background.ts`; construct and
  inject the offscreen clipboard service instead.
- Delete the corresponding tests for the removed code (e.g. content-script /
  iframe-copy unit tests, if present).

## Testing

- **Unit**
  - `offscreen-clipboard-service`: creates the document once and reuses it; de-dupes
    concurrent `copy()` calls into a single create; treats "already exists" as success;
    round-trips text and returns `ok`; propagates an offscreen failure as `ok:false` with
    an error. Uses a mocked `chrome.offscreen` + `chrome.runtime`.
  - `offscreen.ts` message handler: writes via a mocked `document.execCommand` and replies
    `{ ok }`; ignores non-targeted messages.
  - `clipboard-service`: branch selection — `clipboardAPI` present → `writeText`;
    `clipboardAPI` null → delegates to the injected offscreen service.
- **E2E**
  - Rewrite `test/e2e/clipboard/selection-as-markdown-smoke.spec.ts` (currently asserts the
    iframe fallback) to assert the **offscreen** path writes the system clipboard on Chrome.
  - `test/e2e/clipboard/clipboard-smoke.spec.ts` continues to pass unchanged.

## Compatibility / rollout

- `minimum_chrome_version: "109"` means users below Chrome 109 stop receiving updates —
  accepted given current usage.
- New Chrome permissions (`clipboardWrite`, `offscreen`) are warning-free.
- Firefox mv3 behavior is unchanged; firefox-mv2 is out of scope (see above).

## Risks / open items

- **Per-copy creation latency.** Each copy pays `createDocument` (on the order of tens of
  milliseconds). This is imperceptible for a user-initiated copy and is the accepted cost of
  not keeping a document open. Empirically the MV3 service worker is terminated on idle
  regardless of whether an offscreen document is open (an open offscreen document does **not**
  keep the service worker alive — a common claim to the contrary is folklore tied to active
  messaging/ports), so a keep-open document would buy little and risk lingering memory; closing
  per copy keeps the footprint clean and removes the need for any idle-close teardown.
- **Concurrency.** Two copies must not race `createDocument`/`closeDocument` against Chrome's
  "only one offscreen document at a time" rule. Copies are serialized through an in-memory
  promise chain (create → write → close, one at a time); the "already exists" catch on
  creation additionally tolerates a leftover document (failed prior close, or one orphaned by
  a previous service-worker lifetime). In practice clipboard copies are user-gesture-driven and
  effectively never concurrent, but the serialization makes it strictly correct.
- **Playwright + offscreen.** The extension test harness may not expose an API to introspect
  the offscreen document; the smoke test verifies the *system clipboard* content instead, which
  works regardless (confirmed passing). If the offscreen write ever stops functioning headless,
  fall back to the mock-clipboard assertion plus the unit-level round-trip guarantee.
