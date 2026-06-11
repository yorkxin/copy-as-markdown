# PR note: inject the chosen clipboard backend

## What changed
- `ClipboardService` is now a pure write-or-throw interface (`copy(text) → Promise<void>`)
  with two peer backends:
  - `createNavigatorClipboardService(clipboardAPI)` (Firefox)
  - `createOffscreenClipboardService(documentService)` (Chrome)
- `src/background.ts` selects the backend by `BUILD_TARGET` and injects it — the
  runtime `if (clipboardAPI) … else if (offscreenService) … else throw` is gone.
- `createBrowserClipboardServiceController(realService)` owns only the runtime mock
  toggle, persistence, the E2E globals, and the single empty-text rule. It is the
  sole producer of the `boolean` no-op signal (empty text → `false`).
- Removed `createClipboardService` and `createBrowserClipboardService`.
- Mock recorder methods (`getCalls`/`reset`/`getLastCall`) moved off the base
  interface onto `MockClipboardService`.
- Dropped the vestigial `tab` argument from `copy` (and the unread
  `ClipboardMockCall.tab` field) — a leftover from the pre-offscreen mechanism that
  injected a content script into the active tab's DOM (since `971d6a9`, neither the
  offscreen document nor `navigator.clipboard.writeText` needs a tab).

## Why
Brings the clipboard service in line with `MarkdownConverter`: an interface whose
concrete implementation is chosen at the composition root, with no runtime
API-availability checks. Per-target bundles now carry only their own backend. The
boolean return is now honest — it lives only where it is meaningful (the controller's
empty-text no-op), which also drops a latent quirk where a mock storage-save failure
surfaced as a misleading "empty result".

## Behavior
No user-visible change. The empty-result UX (badge vs. feedback) is preserved. E2E
mock hooks unchanged. typecheck / lint / unit+browser / Chrome e2e green.
