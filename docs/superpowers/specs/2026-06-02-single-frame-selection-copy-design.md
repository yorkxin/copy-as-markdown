# Single-Frame Selection Copy — Design Spec

**Issue:** [#258 — Deprecate multiple frame copying in copy selection of markdown](https://github.com/yorkxin/copy-as-markdown/issues/258)
**Related:** #241 (earlier partial workaround that dropped empty frame results)
**Date:** 2026-06-02

## Problem

"Copy Selection as Markdown" currently collects selected text from **every frame** in the
tab and joins the results. This was built on the unproven assumption that users want to
highlight text across multiple iframes and copy it all at once.

In practice this causes broken output on pages that abuse iframes — e.g. invisible iframes
that constantly select all of their own text. Those frames contribute garbage that gets
joined into the user's copied Markdown.

The current implementation injects `selectionToMarkdown` into all frames
(`target: { tabId, allFrames: true }`) and joins every non-empty frame result with `\n\n`
(`src/services/selection-converter-service.ts`).

## Goal

Copy Selection should collect text from **only the single frame the user is interacting
with** — never from background/sibling iframes. A user who wants to copy selections from
multiple frames can do so one frame at a time, since they select text in each frame
manually anyway.

Multi-frame collection (the `\n\n` join across frames) is **removed**.

## Trigger Paths & Frame Identification

There are two entry points, with different frame information available:

| Trigger | Frame info available | How we target the frame |
| --- | --- | --- |
| Context menu (`contextMenus.onClicked`) | `info.frameId` — the exact frame the user right-clicked (always present; `0` = main frame) | Inject into that one frame via `target.frameIds`. No focus heuristic. |
| Keyboard shortcut (`commands.onCommand`) | None — only the tab | Inject into all frames; each frame self-determines whether it is the focused leaf frame and returns `''` otherwise. |

### Why the keyboard path needs a focus heuristic

With no frame ID, we must inject into every frame and then keep only the frame the user is
actually in. A frame is the **focused leaf frame** when:

```js
document.hasFocus() && !(
  document.activeElement instanceof HTMLIFrameElement
  || document.activeElement instanceof HTMLFrameElement
)
```

`document.hasFocus()` is true for the focused frame *and all of its ancestors*, so it alone
cannot pick a single frame. The `activeElement` check excludes ancestor frames (whose
active element is the child frame element), leaving only the leaf the user is in. Background
iframes that auto-select text do not have focus, so they return `''`.

### Why the context-menu path skips the heuristic

Chrome already tells us the precise frame via `info.frameId`. Applying the focus heuristic
on top would be redundant and **risky**: right-clicking does not reliably set
`document.hasFocus()` on every platform/Chrome version, so the heuristic could reject the
very frame Chrome identified and copy nothing. We trust Chrome's `frameId` instead.

## Architecture

A single content-script function is reused for both paths, with a flag that toggles whether
the focus heuristic runs. The flag exists precisely because the two paths identify the
target frame differently — the context-menu path injects into one known-correct frame and
must skip the heuristic, while the keyboard path injects everywhere and depends on it.

### 1. `ScriptingAPI` type — `src/services/shared-types.ts`

Extend the `target` shape to allow targeting specific frames:

```ts
target: { tabId: number; allFrames?: boolean; frameIds?: number[] };
```

### 2. `selectionToMarkdown` — `src/content-scripts/selection-to-markdown.ts`

Add a trailing `onlyIfFocused: boolean` parameter. When `true` and the current frame is not
the focused leaf frame (per the check above), return `''` immediately, before any selection
work. When `false`, behave as today. The trailing position keeps the existing argument order
(`turndownJsURL`, `gfmJsURL`, `turndownOptions`) stable.

### 3. `convertSelectionToMarkdown` — `src/services/selection-converter-service.ts`

New signature: `convertSelectionToMarkdown(tab, frameId?: number)`.

- **`frameId` provided (context menu):**
  - `target: { tabId, frameIds: [frameId] }`
  - `onlyIfFocused = false`
  - Return that single frame's result directly (no joining).
- **`frameId` undefined (keyboard):**
  - `target: { tabId, allFrames: true }`
  - `onlyIfFocused = true`
  - Take the single non-empty result (the focused leaf). The `\n\n` multi-frame join is
    removed. If nothing is focused/selected, return `''`.

### 4. Handlers

- **Context menu** — `src/handlers/context-menu-handler.ts:124`: pass `info.frameId` into
  `convertSelectionToMarkdown(tab, info.frameId)`.
- **Keyboard** — `src/handlers/keyboard-command-handler.ts:59`: call
  `convertSelectionToMarkdown(currentTab)` with no frame ID.

## Data Flow

```
Context menu click ─► onClicked(info, tab)
  └─► handleMenuClick ─► convertSelectionToMarkdown(tab, info.frameId)
        └─► executeScript({ target:{tabId, frameIds:[frameId]}, onlyIfFocused:false })
              └─► selectionToMarkdown runs in exactly that frame ─► Markdown

Keyboard shortcut ─► onCommand(command, tab)
  └─► handleCommand ─► convertSelectionToMarkdown(currentTab)
        └─► executeScript({ target:{tabId, allFrames:true}, onlyIfFocused:true })
              └─► selectionToMarkdown runs in all frames; only focused leaf returns text
                    └─► service keeps the single non-empty result ─► Markdown
```

## Error & Edge Handling

- **No selection / no focused frame:** returns `''` (existing empty-string behavior).
- **`frameId === 0`:** valid — the main frame. Treated like any other explicit frame.
- **Page with no iframes:** top frame has focus and a non-frame active element, so it returns
  its content under both paths.
- **Nested iframes:** only the deepest focused frame returns content; ancestors are excluded
  by the `activeElement` check.

## Testing

Unit — `test/services/selection-converter-service.test.ts`:

- Remove/invert the existing "join results from multiple frames with double newlines" test —
  multi-frame joining is deprecated behavior.
- Context-menu path: given a `frameId`, asserts `executeScript` is called with
  `target: { tabId, frameIds: [frameId] }` and `onlyIfFocused: false`, and returns that
  frame's single result.
- Keyboard path: given no `frameId`, asserts `target: { tabId, allFrames: true }` and
  `onlyIfFocused: true`, and that a single non-empty result is returned (no join).
- Existing "ignore empty frame results" / tab-has-no-id / turndown-options tests updated to
  the new call shape.

Content script — `src/content-scripts/selection-to-markdown.ts` focus heuristic: a focused
test exercising `onlyIfFocused: true` returning `''` when the frame is not the focused leaf,
and returning content when it is. (Verify against the existing browser-test setup in
`test/ui/`.)

Handlers — `test/handlers/context-menu-handler-service.test.ts` and
`test/handlers/command-handler-service.test.ts`: assert the context-menu handler forwards
`info.frameId` and the keyboard handler calls without a frame ID.

## Out of Scope

- Any UI for choosing among frames.
- Changes to the Markdown conversion itself (Turndown rules, code blocks, list handling).
- Firefox-specific frame behavior beyond what the shared `executeScript` abstraction already
  covers.
