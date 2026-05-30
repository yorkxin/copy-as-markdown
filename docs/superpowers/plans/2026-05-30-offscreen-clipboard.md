# Offscreen Clipboard Write Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On Chrome/Edge, perform the clipboard write from an MV3 **offscreen document** (extension-origin, focus-independent) instead of an injected page content script, and remove the iframe / on-page-textarea / content-script clipboard hacks entirely.

**Architecture:** The real clipboard service branches by capability: if a `clipboardAPI` is supplied (Firefox, via the existing `ALWAYS_USE_NAVIGATOR_COPY_API` flag) it writes with `navigator.clipboard.writeText`; otherwise (Chrome) it delegates to a new `offscreen-clipboard-service` that lazily creates a single offscreen document and round-trips the text to it, where `document.execCommand('copy')` runs in an extension-origin context holding `clipboardWrite`. Selection-to-markdown conversion is unchanged.

**Tech Stack:** TypeScript, WebExtensions MV3 (`chrome.offscreen`, `browser.*` polyfill), Vitest (unit), Playwright (e2e).

**Base branch:** `feature/offscreen-clipboard` (already cut from `master`; already contains the `clipboardWrite` permission commit). Spec: `docs/superpowers/specs/2026-05-30-offscreen-clipboard-design.md`.

---

## File Structure

**Create:**
- `src/static/offscreen.html` — hidden offscreen page with a `<textarea>`.
- `src/offscreen.ts` → `dist/offscreen.js` — clipboard write + message listener.
- `src/services/offscreen-clipboard-service.ts` — offscreen lifecycle + round-trip.
- `test/offscreen.test.ts`
- `test/services/offscreen-clipboard-service.test.ts`

**Modify:**
- `src/services/clipboard-service.ts` — branch navigator/offscreen; drop content-script path.
- `test/services/clipboard-service.test.ts` — rewrite the `copy` tests for the new branch.
- `src/background.ts` — drop `iframeCopyUrl`; new controller signature.
- `chrome/manifest.json` — add `offscreen` permission + `minimum_chrome_version`; remove `iframe-copy.html` from `web_accessible_resources`.
- `test/e2e/clipboard/selection-as-markdown-smoke.spec.ts` — assert the offscreen write.

**Delete:**
- `src/content-script.ts`, `src/iframe-copy.ts`, `src/static/iframe-copy.html`.

**Untouched:** `firefox-mv3/manifest.json` (its `web_accessible_resources` already has no `iframe-copy.html`, and Firefox needs no `offscreen` permission). `firefox-mv2/` (out of scope — see spec). `src/content-scripts/selection-to-markdown.ts` (the selection reader — keep).

---

## Task 1: Offscreen document page

**Files:**
- Create: `src/offscreen.ts`
- Create: `src/static/offscreen.html`
- Test: `test/offscreen.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/offscreen.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard } from '../src/offscreen.js';

describe('copyTextToClipboard', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('writes the text via execCommand and returns ok', () => {
    const textarea = { value: '', select: vi.fn() };
    const execCommand = vi.fn(() => true);
    vi.stubGlobal('document', { getElementById: vi.fn(() => textarea), execCommand });

    const result = copyTextToClipboard('hello');

    expect(result).toEqual({ ok: true });
    expect(textarea.select).toHaveBeenCalledOnce();
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('returns an error when execCommand reports failure', () => {
    const textarea = { value: '', select: vi.fn() };
    vi.stubGlobal('document', { getElementById: () => textarea, execCommand: () => false });

    expect(copyTextToClipboard('x')).toEqual({ ok: false, error: 'execCommand returned false' });
  });

  it('returns an error when the textarea is missing', () => {
    vi.stubGlobal('document', { getElementById: () => null, execCommand: () => true });

    expect(copyTextToClipboard('x').ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/offscreen.test.ts`
Expected: FAIL — cannot resolve `../src/offscreen.js`.

- [ ] **Step 3: Create `src/offscreen.ts`**

```typescript
// src/offscreen.ts
const OFFSCREEN_TARGET = 'offscreen-clipboard';

interface OffscreenCopyMessage {
  target?: string;
  text?: string;
}

export interface OffscreenCopyResponse {
  ok: boolean;
  error?: string;
}

/**
 * Write text to the clipboard from inside the offscreen (extension-origin)
 * document. Uses execCommand because an offscreen document is never focused
 * (navigator.clipboard.writeText would reject), but execCommand in an
 * extension-origin document holding the clipboardWrite permission is allowed.
 */
export function copyTextToClipboard(text: string): OffscreenCopyResponse {
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

// Registered only in the extension runtime; guarded so unit tests (no `chrome`)
// can import this module to test copyTextToClipboard in isolation.
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message: OffscreenCopyMessage, _sender, sendResponse) => {
    if (!message || message.target !== OFFSCREEN_TARGET) {
      return undefined;
    }
    sendResponse(copyTextToClipboard(message.text ?? ''));
    return undefined;
  });
}
```

- [ ] **Step 4: Create `src/static/offscreen.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Copy as Markdown - Offscreen</title>
</head>
<body>
  <textarea id="clipboard"></textarea>
  <script type="module" src="../offscreen.js"></script>
</body>
</html>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/offscreen.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/offscreen.ts src/static/offscreen.html test/offscreen.test.ts
git commit --no-gpg-sign -m "feat: add offscreen document for clipboard write

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Offscreen clipboard service (lifecycle + round-trip)

**Files:**
- Create: `src/services/offscreen-clipboard-service.ts`
- Test: `test/services/offscreen-clipboard-service.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/services/offscreen-clipboard-service.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createOffscreenClipboardService, OFFSCREEN_DOCUMENT_URL, OFFSCREEN_TARGET } from '../../src/services/offscreen-clipboard-service.js';

function makeApis(opts?: { createImpl?: () => Promise<void>; sendImpl?: () => Promise<unknown> }) {
  const createDocument = vi.fn(opts?.createImpl ?? (async () => undefined));
  const sendMessage = vi.fn(opts?.sendImpl ?? (async () => ({ ok: true })));
  return { offscreenAPI: { createDocument } as any, runtimeAPI: { sendMessage } as any, createDocument, sendMessage };
}

describe('offscreenClipboardService', () => {
  it('creates the document once and reuses it across copies', async () => {
    const { offscreenAPI, runtimeAPI, createDocument, sendMessage } = makeApis();
    const service = createOffscreenClipboardService(offscreenAPI, runtimeAPI);

    await expect(service.copy('a')).resolves.toBe(true);
    await expect(service.copy('b')).resolves.toBe(true);

    expect(createDocument).toHaveBeenCalledTimes(1);
    expect(createDocument).toHaveBeenCalledWith(expect.objectContaining({ url: OFFSCREEN_DOCUMENT_URL }));
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenLastCalledWith({ target: OFFSCREEN_TARGET, text: 'b' });
  });

  it('de-dupes concurrent copies into a single createDocument', async () => {
    let resolveCreate: () => void = () => {};
    const createImpl = () => new Promise<void>((r) => { resolveCreate = r; });
    const { offscreenAPI, runtimeAPI, createDocument } = makeApis({ createImpl });
    const service = createOffscreenClipboardService(offscreenAPI, runtimeAPI);

    const both = Promise.all([service.copy('a'), service.copy('b')]);
    resolveCreate();
    await both;

    expect(createDocument).toHaveBeenCalledTimes(1);
  });

  it('treats an already-existing document as success', async () => {
    const createImpl = async () => { throw new Error('Only a single offscreen document may be created.'); };
    const { offscreenAPI, runtimeAPI, sendMessage } = makeApis({ createImpl });
    const service = createOffscreenClipboardService(offscreenAPI, runtimeAPI);

    await expect(service.copy('a')).resolves.toBe(true);
    expect(sendMessage).toHaveBeenCalledOnce();
  });

  it('rejects when the offscreen write fails', async () => {
    const sendImpl = async () => ({ ok: false, error: 'execCommand returned false' });
    const { offscreenAPI, runtimeAPI } = makeApis({ sendImpl });
    const service = createOffscreenClipboardService(offscreenAPI, runtimeAPI);

    await expect(service.copy('a')).rejects.toThrow('execCommand returned false');
  });

  it('retries creation after a genuine (non-exists) creation failure', async () => {
    let calls = 0;
    const createImpl = async () => { calls += 1; if (calls === 1) throw new Error('boom'); };
    const { offscreenAPI, runtimeAPI, createDocument } = makeApis({ createImpl });
    const service = createOffscreenClipboardService(offscreenAPI, runtimeAPI);

    await expect(service.copy('a')).rejects.toThrow('boom');
    await expect(service.copy('b')).resolves.toBe(true);
    expect(createDocument).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/offscreen-clipboard-service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/services/offscreen-clipboard-service.ts`**

```typescript
// src/services/offscreen-clipboard-service.ts
export interface OffscreenClipboardService {
  copy: (text: string) => Promise<boolean>;
}

export const OFFSCREEN_DOCUMENT_URL = 'dist/static/offscreen.html';
export const OFFSCREEN_TARGET = 'offscreen-clipboard';

type OffscreenAPI = Pick<typeof chrome.offscreen, 'createDocument'>;
type RuntimeAPI = Pick<typeof chrome.runtime, 'sendMessage'>;

export function createOffscreenClipboardService(
  offscreenAPI: OffscreenAPI = chrome.offscreen,
  runtimeAPI: RuntimeAPI = chrome.runtime,
): OffscreenClipboardService {
  // Lazy keep-open singleton. `documentReady` is set once and reused; it is
  // reset only on a genuine creation failure so the next copy can retry.
  let documentReady: Promise<void> | null = null;

  async function createOnce(): Promise<void> {
    try {
      await offscreenAPI.createDocument({
        url: OFFSCREEN_DOCUMENT_URL,
        reasons: ['CLIPBOARD' as chrome.offscreen.Reason],
        justification: 'Write Markdown text to the system clipboard.',
      });
    } catch (error) {
      // A document already exists (concurrent caller, or a previous service
      // worker lifetime created it and persisted across the restart).
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('Only a single offscreen document')) {
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

  async function copy(text: string): Promise<boolean> {
    await ensureDocument();
    const response = await runtimeAPI.sendMessage({ target: OFFSCREEN_TARGET, text }) as
      { ok?: boolean; error?: string } | undefined;
    if (!response?.ok) {
      throw new Error(`offscreen clipboard write failed: ${response?.error ?? 'no response'}`);
    }
    return true;
  }

  return { copy };
}

export function createBrowserOffscreenClipboardService(): OffscreenClipboardService | null {
  if (typeof chrome === 'undefined' || !chrome.offscreen) {
    return null;
  }
  return createOffscreenClipboardService();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/offscreen-clipboard-service.test.ts`
Expected: PASS (all five cases).

- [ ] **Step 5: Commit**

```bash
git add src/services/offscreen-clipboard-service.ts test/services/offscreen-clipboard-service.test.ts
git commit --no-gpg-sign -m "feat: add offscreen clipboard service with lazy singleton lifecycle

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Branch the clipboard service to navigator/offscreen

**Files:**
- Modify: `src/services/clipboard-service.ts`
- Test: `test/services/clipboard-service.test.ts` (rewrite the `copy` describe block)

- [ ] **Step 1: Rewrite the `copy` tests**

Replace the entire `describe('copy', () => { ... })` block (the content-script tests) in `test/services/clipboard-service.test.ts` with the block below. **Keep** the `describe('mock copy', () => { ... })` block that follows it unchanged. Also update the imports at the top of the file to those shown here (drop `ScriptingAPI` / `TabsAPI` / `content-script`).

```typescript
// top of test/services/clipboard-service.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createClipboardService, createMockClipboardService } from '../../src/services/clipboard-service.js';
import type { ClipboardAPI } from '../../src/services/shared-types.js';
import type { OffscreenClipboardService } from '../../src/services/offscreen-clipboard-service.js';
```

```typescript
  describe('copy', () => {
    const tab: browser.tabs.Tab = {
      id: 1, index: 0, pinned: false, highlighted: false, windowId: 1, active: true, incognito: false, mutedInfo: { muted: false },
    };

    function makeOffscreen(ok = true): OffscreenClipboardService & { copy: ReturnType<typeof vi.fn> } {
      return { copy: vi.fn(async () => ok) } as any;
    }

    it('writes via clipboardAPI when provided (Firefox path)', async () => {
      const writeText = vi.fn<(t: string) => Promise<void>>(async () => {});
      const clipboardAPI: ClipboardAPI = { writeText };
      const offscreen = makeOffscreen();
      const service = createClipboardService(clipboardAPI, offscreen);

      await expect(service.copy('hello', tab)).resolves.toBe(true);
      expect(writeText).toHaveBeenCalledExactlyOnceWith('hello');
      expect(offscreen.copy).not.toHaveBeenCalled();
    });

    it('delegates to the offscreen service when clipboardAPI is null (Chrome path)', async () => {
      const offscreen = makeOffscreen();
      const service = createClipboardService(null, offscreen);

      await expect(service.copy('hello', tab)).resolves.toBe(true);
      expect(offscreen.copy).toHaveBeenCalledExactlyOnceWith('hello');
    });

    it('returns false for empty text without touching either mechanism', async () => {
      const writeText = vi.fn<(t: string) => Promise<void>>(async () => {});
      const offscreen = makeOffscreen();
      const service = createClipboardService({ writeText }, offscreen);

      await expect(service.copy('')).resolves.toBe(false);
      expect(writeText).not.toHaveBeenCalled();
      expect(offscreen.copy).not.toHaveBeenCalled();
    });

    it('throws when no clipboard mechanism is available', async () => {
      const service = createClipboardService(null, null);

      await expect(service.copy('hello')).rejects.toThrow('no clipboard mechanism available');
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/clipboard-service.test.ts`
Expected: FAIL — `createClipboardService` still has the old `(scriptingAPI, tabsAPI, clipboardAPI, iframeUrl)` signature, so the 2-arg calls don't typecheck / behave as expected.

- [ ] **Step 3: Rewrite the service**

In `src/services/clipboard-service.ts`:

Replace the imports at the top:

```typescript
import type { ClipboardAPI } from './shared-types.js';
import type { OffscreenClipboardService } from './offscreen-clipboard-service.js';
import { createBrowserOffscreenClipboardService } from './offscreen-clipboard-service.js';
```

Replace `createClipboardService` (the whole function) with:

```typescript
export function createClipboardService(
  clipboardAPI: ClipboardAPI | null,
  offscreenService: OffscreenClipboardService | null,
): ClipboardService {
  async function copy_(text: string): Promise<boolean> {
    if (text === '') {
      return false;
    }
    // Firefox: write directly with navigator.clipboard from the background.
    if (clipboardAPI) {
      await clipboardAPI.writeText(text);
      return true;
    }
    // Chrome: write via the offscreen document.
    if (offscreenService) {
      return await offscreenService.copy(text);
    }
    throw new Error('no clipboard mechanism available');
  }

  return {
    copy: copy_,
  };
}
```

Replace `createBrowserClipboardService` with:

```typescript
export function createBrowserClipboardService(
  clipboardAPI: ClipboardAPI | null,
  mockMode = false,
): ClipboardService {
  if (mockMode) {
    return createMockClipboardService();
  }

  return createClipboardService(clipboardAPI, createBrowserOffscreenClipboardService());
}
```

In `createBrowserClipboardServiceController`, remove the `iframeUrl: string` parameter and update the two internal `createBrowserClipboardService(...)` calls to drop the `iframeUrl` argument:

```typescript
export function createBrowserClipboardServiceController(
  clipboardAPI: ClipboardAPI | null,
  options?: {
    storageArea?: browser.storage.StorageArea;
    storageKey?: string;
    defaultMockState?: boolean;
  },
): ClipboardServiceController {
  // ...unchanged option parsing...
  let activeService = createBrowserClipboardService(clipboardAPI, mockMode);
  // ...
  // inside setMockMode:
  activeService = createBrowserClipboardService(clipboardAPI, mockMode);
  // ...
}
```

Delete the now-unused `copyUsingContentScript` function, the `import copy from '../content-script.js'` line, the `mustGetCurrentTab` import, and the `ScriptingAPI` / `TabsAPI` imports. The `ClipboardService.copy` interface signature stays `(text: string, tab?: browser.tabs.Tab) => Promise<boolean>` (the mock still records `tab`; the real `copy_` ignores the extra argument).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/clipboard-service.test.ts`
Expected: PASS (new `copy` tests + the preserved `mock copy` tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: this WILL still error in `src/background.ts` (it passes `iframeCopyUrl` to the controller). That is fixed in Task 4. Confirm the only errors are in `src/background.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/services/clipboard-service.ts test/services/clipboard-service.test.ts
git commit --no-gpg-sign -m "refactor: branch clipboard write to navigator (Firefox) or offscreen (Chrome)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Update background wiring

**Files:**
- Modify: `src/background.ts`

- [ ] **Step 1: Remove the iframe URL and update the controller call**

Delete this line (currently line 38):

```typescript
const iframeCopyUrl = browser.runtime.getURL('dist/static/iframe-copy.html');
```

Change the controller construction (currently lines 42-45) from:

```typescript
const clipboardService = createBrowserClipboardServiceController(
  useNavigatorClipboard ? navigator.clipboard : null,
  iframeCopyUrl,
);
```

to:

```typescript
const clipboardService = createBrowserClipboardServiceController(
  useNavigatorClipboard ? navigator.clipboard : null,
);
```

Leave everything else (the `clipboardService.copy(text, tab)` calls, mock wiring, etc.) unchanged.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Run the full unit suite**

Run: `npx vitest run`
Expected: PASS (the `content-script` / iframe tests were removed in Task 3; nothing imports them now).

- [ ] **Step 4: Commit**

```bash
git add src/background.ts
git commit --no-gpg-sign -m "refactor: drop iframe clipboard URL from background wiring

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Delete the dead clipboard hacks

**Files:**
- Delete: `src/content-script.ts`, `src/iframe-copy.ts`, `src/static/iframe-copy.html`

- [ ] **Step 1: Confirm nothing imports them**

Run: `grep -rn "content-script\.js\|iframe-copy" src/ test/`
Expected: no matches (Task 3 removed the import; the selection reader lives at `src/content-scripts/selection-to-markdown.ts`, a different path, and must NOT match — if it does, you grepped too broadly).

- [ ] **Step 2: Delete the files**

```bash
git rm src/content-script.ts src/iframe-copy.ts src/static/iframe-copy.html
```

- [ ] **Step 3: Typecheck + unit tests**

Run: `npm run typecheck && npx vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit --no-gpg-sign -m "chore: remove iframe and on-page-textarea clipboard hacks

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Manifest changes (Chrome)

**Files:**
- Modify: `chrome/manifest.json`

- [ ] **Step 1: Add the offscreen permission and minimum version**

In `chrome/manifest.json`, change the `permissions` array from:

```json
  "permissions": [
    "activeTab",
    "alarms",
    "contextMenus",
    "clipboardWrite",
    "scripting",
    "storage"
  ],
```

to:

```json
  "permissions": [
    "activeTab",
    "alarms",
    "contextMenus",
    "clipboardWrite",
    "offscreen",
    "scripting",
    "storage"
  ],
```

Add a `"minimum_chrome_version"` key next to `"manifest_version"` (top-level), e.g. immediately after the `"manifest_version": 3,` line:

```json
  "minimum_chrome_version": "109",
```

- [ ] **Step 2: Remove the iframe resource from `web_accessible_resources`**

Change the `resources` array from:

```json
      "resources": [
        "dist/static/iframe-copy.html",
        "dist/vendor/turndown.mjs",
        "dist/vendor/turndown-plugin-gfm.mjs"
      ],
```

to:

```json
      "resources": [
        "dist/vendor/turndown.mjs",
        "dist/vendor/turndown-plugin-gfm.mjs"
      ],
```

- [ ] **Step 3: Validate the manifest JSON**

Run: `node -e "const m=require('./chrome/manifest.json'); console.log(m.permissions.join(','), '|', m.minimum_chrome_version, '|', JSON.stringify(m.web_accessible_resources[0].resources))"`
Expected: permissions include `offscreen`, `minimum_chrome_version` is `109`, and the resources list no longer contains `iframe-copy.html`.

- [ ] **Step 4: Commit**

```bash
git add chrome/manifest.json
git commit --no-gpg-sign -m "feat: declare offscreen permission and minimum_chrome_version 109

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: End-to-end smoke test for the offscreen write

**Files:**
- Modify: `test/e2e/clipboard/selection-as-markdown-smoke.spec.ts`

This test runs with the **real** clipboard (mock disabled) and reads the system clipboard, so it verifies the offscreen write end-to-end *without* needing to introspect the offscreen document.

> **Note on Playwright + offscreen documents:** Playwright's extension harness may not expose an API to access or assert the existence/state of the offscreen document. That's fine — **do not try hard to introspect it.** Verifying the system clipboard receives the correct text (below) is the real goal and works regardless. Asserting the offscreen document directly is nice-to-have, not a requirement; skip it if there's no straightforward API.
>
> If the offscreen write genuinely does not function in the headless Playwright environment at all (the system clipboard stays empty even though the unit tests pass), do **not** block the plan on it: revert this test to assert via mock-clipboard mode (set mock on, assert the recorded call) and rely on the Task 1–3 unit tests for the offscreen round-trip guarantee. Note which path you took in the commit message.

- [ ] **Step 1: Rewrite the test body**

Replace the single `test(...)` in `test/e2e/clipboard/selection-as-markdown-smoke.spec.ts` with:

```typescript
  test('copies markdown to the system clipboard via the offscreen document', async ({ page }) => {
    await page.goto('http://localhost:5566/selection-noisy.html');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      const range = document.createRange();
      const content = document.querySelector('#content');
      if (!content) {
        throw new Error('Missing #content');
      }
      range.selectNodeContents(content);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });

    await serviceWorker.evaluate(() => {
      // @ts-expect-error - Chrome APIs are available in extension workers
      return chrome.commands.onCommand.dispatch('selection-as-markdown');
    });

    await page.bringToFront();
    const clipboardText = normalizeLineEndings(await waitForSystemClipboard(5000));
    const expectedMarkdown = await readFile(join(__dirname, '../../../fixtures/selection-noisy.md'), 'utf-8');

    expect(clipboardText).toEqual(normalizeLineEndings(expectedMarkdown));
  });
```

Keep the file's existing imports, the `normalizeLineEndings` helper, the `test.describe.configure({ mode: 'serial' })`, and the `beforeEach`/`afterEach` hooks (they disable the mock clipboard and reset the system clipboard). Remove the now-irrelevant `ConsoleMessage` console-error assertion and its `page.on('console', ...)` wiring if present.

- [ ] **Step 2: Build the test extension and run the smoke test**

Run: `npm run test:e2e -- --project=clipboard-smoke --no-deps`
Expected: PASS — the `selection-as-markdown` smoke test writes the expected markdown to the system clipboard via the offscreen document, and the other `clipboard-smoke` tests still pass.

(If it fails *only* because the offscreen write doesn't work in the harness, apply the fallback described in the Note above.)

- [ ] **Step 3: Commit**

```bash
git add test/e2e/clipboard/selection-as-markdown-smoke.spec.ts
git commit --no-gpg-sign -m "test: assert selection copy writes the clipboard via the offscreen document

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Full verification

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors (use `npm run lint:fix` for autofixable issues).

- [ ] **Step 3: Unit tests**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 4: Build all targets**

Run: `npm run compile`
Expected: success. Then confirm the offscreen page shipped and the iframe page did not:

Run: `ls chrome/dist/static/offscreen.html chrome/dist/offscreen.js && ! ls chrome/dist/static/iframe-copy.html 2>/dev/null && echo OK`
Expected: prints the offscreen paths and `OK`.

- [ ] **Step 5: E2E**

Run: `npm run test:e2e`
Expected: all PASS (note: an unrelated `bookmarks.spec.ts` flake under full-parallel load may need a re-run; it passes in isolation).

- [ ] **Step 6: Manual smoke (recommended)**

Run `npm run debug-chrome`, then on a focus-managing page (e.g. GitHub) select text and use Copy Selection as Markdown via both the context menu and the keyboard shortcut, including the tab-switch-away-and-back sequence. Confirm the clipboard receives the markdown every time.

- [ ] **Step 7: Final commit (if verification fixups were needed)**

```bash
git add -A
git commit --no-gpg-sign -m "chore: offscreen clipboard verification fixups

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** offscreen on Chrome (Tasks 1, 2, 3); navigator on Firefox unchanged (Task 3 `clipboardAPI` branch); M109+ + `offscreen` permission + WAR removal (Task 6); `clipboardWrite` already present (prior commit); lazy keep-open singleton with "already exists" handling and concurrent de-dupe (Task 2); full removal of `content-script.ts`/`iframe-copy.*`/on-page-textarea (Tasks 3, 5); selection reader untouched (not modified); firefox-mv3 needs no change (WAR already lacks the iframe entry) and firefox-mv2 untouched; unit + e2e tests (Tasks 1–3, 7); Playwright-offscreen caveat (Task 7). ✓
- **Type consistency:** `OffscreenClipboardService.copy(text)`, `createOffscreenClipboardService(offscreenAPI?, runtimeAPI?)`, `createBrowserOffscreenClipboardService()`, `OFFSCREEN_DOCUMENT_URL`, `OFFSCREEN_TARGET` defined in Task 2 and consumed unchanged in Task 3. `createClipboardService(clipboardAPI, offscreenService)` and `createBrowserClipboardService(clipboardAPI, mockMode)` defined in Task 3 and used in Task 4. `copyTextToClipboard` / `OffscreenCopyResponse` from Task 1 used by the Task 1 listener.
- **No fallback path on Chrome:** by design (M109+); `createClipboardService` throws if neither mechanism is present, surfacing as the existing error badge.
