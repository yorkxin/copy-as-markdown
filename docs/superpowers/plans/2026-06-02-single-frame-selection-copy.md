# Single-Frame Selection Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "Copy Selection as Markdown" collect text from only the single frame the user is interacting with, instead of joining selections from every frame in the tab.

**Architecture:** One self-contained content-script function (`selectionToMarkdown`) gains an `onlyIfFocused` flag. The context-menu path injects into the exact frame Chrome reports (`info.frameId`) with the flag off; the keyboard path injects into all frames with the flag on, and each frame returns `''` unless it is the focused leaf frame. The service picks the single non-empty result — the multi-frame `\n\n` join is removed.

**Tech Stack:** TypeScript, Chrome MV3 `scripting.executeScript`, Turndown, Vitest (unit + browser projects), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-06-02-single-frame-selection-copy-design.md`

---

## File Structure

- `src/content-scripts/selection-to-markdown.ts` — add `onlyIfFocused` param + focused-leaf-frame guard.
- `src/services/shared-types.ts` — extend `ScriptingAPI` target to allow `frameIds`.
- `src/services/selection-converter-service.ts` — new `frameId?` argument; route target + flag; drop the join.
- `src/handlers/context-menu-handler.ts` — forward `info.frameId`.
- `src/handlers/keyboard-command-handler.ts` — no code change (already calls with no frame id); covered by existing tests.
- Tests: `test/ui/selection-focus-frame.spec.ts` (new, browser), `test/services/selection-converter-service.test.ts`, `test/handlers/context-menu-handler-service.test.ts`, three existing `test/ui/selection-*.spec.ts` helper callers, and `test/e2e/formatting/selection-as-markdown.spec.ts`.

**Test commands:**
- Unit project: `npm run test:unit -- <path>` (or `npx vitest run --project unit <path>`)
- Browser project: `npm run test:browser -- <path>` (or `npx vitest run --project browser <path>`)
- Full unit+browser: `npm test`
- E2E (heavy; builds the extension): `npm run test:e2e -- test/e2e/formatting/selection-as-markdown.spec.ts`

All commands run from the worktree root `/Users/yorkxin/code/copy-as-markdown/.claude/worktrees/fix-258-single-frame-selection`.

---

## Task 1: Add `onlyIfFocused` flag to the content-script function

**Files:**
- Modify: `src/content-scripts/selection-to-markdown.ts:10-14` (signature) and `:48` (add guard before loading Turndown)
- Modify existing callers: `test/ui/selection-trailing-newlines.spec.ts:11-18`, `test/ui/selection-code-block.spec.ts`, `test/ui/selection-list-paragraph.spec.ts`
- Test: `test/ui/selection-focus-frame.spec.ts` (create)

- [ ] **Step 1: Write the failing browser test**

Create `test/ui/selection-focus-frame.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { selectionToMarkdown } from '../../src/content-scripts/selection-to-markdown.js';

const TURNDOWN = '/src/vendor/turndown.mjs';
const GFM = '/src/vendor/turndown-plugin-gfm.mjs';
const OPTS = { headingStyle: 'atx' as const, bulletListMarker: '-' as const };

function selectNode(selector: string): void {
  const node = document.querySelector(selector);
  if (!node) {
    throw new Error(`selection target not found: ${selector}`);
  }
  const range = document.createRange();
  range.selectNode(node);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

describe('selectionToMarkdown focused-frame heuristic', () => {
  it('returns content when onlyIfFocused is true and this document is the focused leaf', async () => {
    document.body.innerHTML = '<h1 id="h">Hello</h1>';
    try {
      selectNode('#h');
      const md = await selectionToMarkdown(TURNDOWN, GFM, OPTS, true);
      expect(md).toBe('# Hello');
    } finally {
      window.getSelection()?.removeAllRanges();
      document.body.innerHTML = '';
    }
  });

  it('returns empty string when onlyIfFocused is true but a sub-frame is the active element', async () => {
    document.body.innerHTML = '<h1 id="h">Hello</h1><iframe id="f"></iframe>';
    try {
      selectNode('#h');
      (document.querySelector('#f') as HTMLIFrameElement).focus();
      const md = await selectionToMarkdown(TURNDOWN, GFM, OPTS, true);
      expect(md).toBe('');
    } finally {
      window.getSelection()?.removeAllRanges();
      document.body.innerHTML = '';
    }
  });

  it('ignores the heuristic and returns content when onlyIfFocused is false', async () => {
    document.body.innerHTML = '<h1 id="h">Hello</h1><iframe id="f"></iframe>';
    try {
      selectNode('#h');
      (document.querySelector('#f') as HTMLIFrameElement).focus();
      const md = await selectionToMarkdown(TURNDOWN, GFM, OPTS, false);
      expect(md).toBe('# Hello');
    } finally {
      window.getSelection()?.removeAllRanges();
      document.body.innerHTML = '';
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:browser -- test/ui/selection-focus-frame.spec.ts`
Expected: FAIL — `selectionToMarkdown` currently takes 3 args, so the 4th-arg calls won't compile / the heuristic branches don't exist (the empty-string case returns `# Hello`).

- [ ] **Step 3: Add the `onlyIfFocused` parameter and guard**

In `src/content-scripts/selection-to-markdown.ts`, change the signature (lines 10-14) to add a 4th parameter and simplify the return type:

```ts
export async function selectionToMarkdown(
  turndownJsURL: string,
  gfmJsURL: string,
  turndownOptions: TurndownOptions,
  onlyIfFocused: boolean,
): Promise<string> {
```

Then, as the **first statements inside the function body** (before the `await import(turndownJsURL)` on line 17, so non-focused frames short-circuit without loading Turndown), insert:

```ts
  // When triggered without a precise frame (keyboard shortcut), this function runs in
  // every frame. Only the frame the user is actually in should contribute text. A frame
  // is the focused leaf when the document has focus AND its active element is not a nested
  // frame (ancestors of the focused frame report hasFocus() too, but their activeElement is
  // the child frame element). Background iframes that auto-select text do not have focus.
  if (onlyIfFocused) {
    const active = document.activeElement;
    const activeIsSubFrame
      = active instanceof HTMLIFrameElement || active instanceof HTMLFrameElement;
    if (!document.hasFocus() || activeIsSubFrame) {
      return '';
    }
  }
```

- [ ] **Step 4: Update the three existing UI spec helpers to pass `false`**

These helpers call `selectionToMarkdown` with 3 args and now need the 4th. They exercise the context-menu-style "no heuristic" behavior, so pass `false`.

In `test/ui/selection-trailing-newlines.spec.ts` (lines 11-18), change the call to:

```ts
    return await selectionToMarkdown(
      '/src/vendor/turndown.mjs',
      '/src/vendor/turndown-plugin-gfm.mjs',
      {
        headingStyle: 'atx',
        bulletListMarker: '-',
      },
      false,
    );
```

In `test/ui/selection-code-block.spec.ts` and `test/ui/selection-list-paragraph.spec.ts`, find each `selectionToMarkdown(` call inside their local `convertSelectionToMarkdown` helpers and add `false` as the final argument, matching the pattern above. (Search each file for `selectionToMarkdown(` to locate the single call site per file.)

- [ ] **Step 5: Run the new test and the updated helpers**

Run: `npm run test:browser`
Expected: PASS — all `test/ui/*.spec.ts` including the new `selection-focus-frame.spec.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/content-scripts/selection-to-markdown.ts test/ui/
git commit -m "feat: add onlyIfFocused guard to selectionToMarkdown content script"
```

---

## Task 2: Allow targeting specific frames in the ScriptingAPI type

**Files:**
- Modify: `src/services/shared-types.ts:52-57`

- [ ] **Step 1: Extend the target type**

In `src/services/shared-types.ts`, the `executeScript` target currently is `{ tabId: number; allFrames?: boolean }`. Change it to also allow `frameIds`:

```ts
  executeScript: <T extends any[]>(options: {
    target: { tabId: number; allFrames?: boolean; frameIds?: number[] };
    func?: (...args: T) => any;
    files?: string[];
    args?: T;
  }) => Promise<Array<{ result?: any }>>;
```

- [ ] **Step 2: Verify the project type-checks**

Run: `npx tsc --noEmit`
Expected: PASS (no new type errors). This is a type-only change with no behavior, so there is no separate test; the service tests in Task 3 exercise it.

- [ ] **Step 3: Commit**

```bash
git add src/services/shared-types.ts
git commit -m "feat: allow frameIds targeting in ScriptingAPI type"
```

---

## Task 3: Route the service by frameId and drop the multi-frame join

**Files:**
- Modify: `src/services/selection-converter-service.ts:9-17` (interface + JSDoc) and `:25-49` (implementation)
- Test: `test/services/selection-converter-service.test.ts`

- [ ] **Step 1: Update the service tests (the failing spec)**

In `test/services/selection-converter-service.test.ts`:

(a) In the first test, `should load turndown library and execute conversion`, the call has no frame id (keyboard path), so the args now include the `onlyIfFocused` flag `true`. Replace the `executeScriptMock` assertion (currently lines 51-62) with:

```ts
      expect(executeScriptMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
        target: {
          tabId: 123,
          allFrames: true,
        },
        func: selectionToMarkdown,
        args: [
          'dist/vendor/turndown.mjs',
          'dist/vendor/turndown-plugin-gfm.mjs',
          turndownOptions,
          true,
        ],
      }));
```

(b) Replace the entire `should join results from multiple frames with double newlines` test (lines 65-108) with a test that asserts only the focused frame's content is returned (no join):

```ts
    it('returns only the single non-empty frame result without joining', async () => {
      const executeScriptMock = vi.fn(async () => [
        { result: '' },
        { result: 'Focused frame content' },
        { result: '' },
      ]);

      const mockScriptingAPI: ScriptingAPI = {
        executeScript: executeScriptMock,
      };

      const mockTurndownOptionsProvider: TurndownOptionsProvider = {
        getTurndownOptions: () => ({ headingStyle: 'atx' }),
      };

      const service = createSelectionConverterService(
        mockScriptingAPI,
        mockTurndownOptionsProvider,
        'dist/vendor/turndown.mjs',
        'dist/vendor/turndown-plugin-gfm.mjs',
      );

      const tab: browser.tabs.Tab = {
        id: 456,
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        mutedInfo: { muted: false },
      };

      const result = await service.convertSelectionToMarkdown(tab);

      expect(result).toBe('Focused frame content');
    });
```

(c) Add two new tests covering the context-menu (frameId) path. Insert after the test added in (b):

```ts
    it('targets the given frame and disables the focus filter when a frameId is provided', async () => {
      const executeScriptMock = vi.fn(async () => [{ result: 'Frame 7 markdown' }]);

      const mockScriptingAPI: ScriptingAPI = {
        executeScript: executeScriptMock,
      };

      const mockTurndownOptionsProvider: TurndownOptionsProvider = {
        getTurndownOptions: () => ({ headingStyle: 'atx' }),
      };

      const service = createSelectionConverterService(
        mockScriptingAPI,
        mockTurndownOptionsProvider,
        'dist/vendor/turndown.mjs',
        'dist/vendor/turndown-plugin-gfm.mjs',
      );

      const tab: browser.tabs.Tab = {
        id: 555,
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        mutedInfo: { muted: false },
      };

      const result = await service.convertSelectionToMarkdown(tab, 7);

      expect(result).toBe('Frame 7 markdown');
      expect(executeScriptMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
        target: {
          tabId: 555,
          frameIds: [7],
        },
        args: [
          'dist/vendor/turndown.mjs',
          'dist/vendor/turndown-plugin-gfm.mjs',
          { headingStyle: 'atx' },
          false,
        ],
      }));
    });

    it('treats frameId 0 (main frame) as an explicit frame, not "no frame"', async () => {
      const executeScriptMock = vi.fn(async () => [{ result: 'Main frame markdown' }]);

      const mockScriptingAPI: ScriptingAPI = {
        executeScript: executeScriptMock,
      };

      const mockTurndownOptionsProvider: TurndownOptionsProvider = {
        getTurndownOptions: () => ({ headingStyle: 'atx' }),
      };

      const service = createSelectionConverterService(
        mockScriptingAPI,
        mockTurndownOptionsProvider,
        'dist/vendor/turndown.mjs',
        'dist/vendor/turndown-plugin-gfm.mjs',
      );

      const tab: browser.tabs.Tab = {
        id: 556,
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        mutedInfo: { muted: false },
      };

      await service.convertSelectionToMarkdown(tab, 0);

      expect(executeScriptMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
        target: {
          tabId: 556,
          frameIds: [0],
        },
        args: [
          'dist/vendor/turndown.mjs',
          'dist/vendor/turndown-plugin-gfm.mjs',
          { headingStyle: 'atx' },
          false,
        ],
      }));
    });
```

(d) In the `should use turndown options from provider` test (lines 178-229), the call has no frame id, so add the `onlyIfFocused` flag `true` to the expected args. Change the `args` array in the final assertion to:

```ts
        args: [
          'dist/vendor/turndown.mjs',
          'dist/vendor/turndown-plugin-gfm.mjs',
          {
            headingStyle: 'setext',
            bulletListMarker: '*',
            customOption: 'value',
          },
          true,
        ],
```

(e) The `should ignore empty frame results when joining` test (lines 110-146) stays valid as the keyboard path returning the single non-empty result; rename its title to `returns the single non-empty result and ignores empty frames` (change only the `it(...)` string). The `should throw error when tab has no id` test is unchanged.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:unit -- test/services/selection-converter-service.test.ts`
Expected: FAIL — the service still passes 3 args / uses `allFrames` always / joins with `\n\n`, so the new frameId and `onlyIfFocused` assertions fail.

- [ ] **Step 3: Update the service interface and JSDoc**

In `src/services/selection-converter-service.ts`, replace the interface (lines 9-17) with:

```ts
export interface SelectionConverterService {
  /**
   * Convert the current selection in a tab to Markdown.
   *
   * @param tab - The browser tab containing the selection
   * @param frameId - The frame the user interacted with (from contextMenus.OnClickData).
   *   When provided, only that frame is read. When omitted (keyboard shortcut), the
   *   converter runs in all frames and keeps only the focused leaf frame's result.
   * @returns The selection converted to Markdown for the single target frame
   */
  convertSelectionToMarkdown: (tab: browser.tabs.Tab, frameId?: number) => Promise<string>;
}
```

- [ ] **Step 4: Update the implementation**

In `src/services/selection-converter-service.ts`, replace the `convertSelectionToMarkdown` function body (lines 25-49) with:

```ts
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

    // turndown.js must be loaded in the content because it parses the HTML using DOM API.
    const results = await scriptingAPI.executeScript({
      target,
      func: selectionToMarkdown,
      args: [
        turndownJsURL,
        gfmPluginURL,
        turndownOptionsProvider.getTurndownOptions(),
        onlyIfFocused,
      ],
    });

    // Exactly one frame should contribute text: either the explicitly targeted frame, or
    // (keyboard path) the single focused leaf frame. Return that one result; no joining.
    const content = results
      .map(frame => frame.result as string)
      .find(result => result !== undefined && result !== '');
    return content ?? '';
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:unit -- test/services/selection-converter-service.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 6: Commit**

```bash
git add src/services/selection-converter-service.ts test/services/selection-converter-service.test.ts
git commit -m "feat: read selection from a single frame, removing multi-frame join (#258)"
```

---

## Task 4: Forward `info.frameId` from the context-menu handler

**Files:**
- Modify: `src/handlers/context-menu-handler.ts:120-125`
- Test: `test/handlers/context-menu-handler-service.test.ts:56-68`

- [ ] **Step 1: Update the handler test (the failing spec)**

In `test/handlers/context-menu-handler-service.test.ts`, replace the `exports selection as markdown` test (lines 56-68) with a version that supplies and asserts `frameId`:

```ts
  it('exports selection as markdown for the clicked frame', async () => {
    const convertMock = vi.fn(async () => 'md');
    const handler = createContextMenuHandler(
      createServices({ selectionConverterService: { convertSelectionToMarkdown: convertMock } }),
      () => ({ getSubTree: vi.fn() }),
      { toMarkdown: vi.fn() },
    );

    const tab = createMockTab();
    const result = await handler.handleMenuClick(
      { menuItemId: 'selection-as-markdown', frameId: 3 } as any,
      tab,
    );
    expect(result).toBe('md');
    expect(convertMock).toHaveBeenCalledWith(tab, 3);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- test/handlers/context-menu-handler-service.test.ts`
Expected: FAIL — the handler currently calls `convertSelectionToMarkdown(tab)` (one arg), so `toHaveBeenCalledWith(tab, 3)` fails.

- [ ] **Step 3: Update the handler**

In `src/handlers/context-menu-handler.ts`, change the `SelectionAsMarkdown` branch (line 124) from:

```ts
      return services.selectionConverterService.convertSelectionToMarkdown(tab);
```

to:

```ts
      return services.selectionConverterService.convertSelectionToMarkdown(tab, info.frameId);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- test/handlers/context-menu-handler-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Confirm the keyboard handler is unchanged and still correct**

The keyboard handler (`src/handlers/keyboard-command-handler.ts:59`) already calls `convertSelectionToMarkdown(currentTab)` with no frame id — exactly the keyboard (all-frames + focus filter) path. No code change needed.

Run: `npm run test:unit -- test/handlers/command-handler-service.test.ts`
Expected: PASS (existing `toHaveBeenCalledWith(providedTab)` / `(tab)` assertions still hold because we call with a single argument).

- [ ] **Step 6: Commit**

```bash
git add src/handlers/context-menu-handler.ts test/handlers/context-menu-handler-service.test.ts
git commit -m "feat: context menu copies selection from the clicked frame only (#258)"
```

---

## Task 5: Update the e2e context-menu test and run full verification

**Files:**
- Modify: `test/e2e/formatting/selection-as-markdown.spec.ts:118`

- [ ] **Step 1: Pass an explicit frameId in the context-menu e2e test**

Real Chrome always sends `frameId` (0 for the main frame) on context-menu clicks; the test helper omits it by default. Make the e2e exercise the precise-frame branch. In `test/e2e/formatting/selection-as-markdown.spec.ts`, change line 118 from:

```ts
    await triggerContextMenu(serviceWorker, 'selection-as-markdown');
```

to:

```ts
    await triggerContextMenu(serviceWorker, 'selection-as-markdown', { frameId: 0 });
```

- [ ] **Step 2: Run the full unit + browser suite**

Run: `npm test`
Expected: PASS — all unit and browser tests, including the changed service, handler, content-script, and UI specs.

- [ ] **Step 3: Run the selection e2e (heavier; builds the extension)**

Run: `npm run test:e2e -- test/e2e/formatting/selection-as-markdown.spec.ts`
Expected: PASS — both `should copy selection as markdown` (keyboard path; the test page is focused so the top frame reports `hasFocus()`) and `should copy selection via context menu` (now exercising `frameId: 0`).

If the keyboard-path e2e is flaky because the headless page does not report focus, that is an environment focus issue, not a logic error — note it and confirm the deterministic unit/browser coverage from Tasks 1 and 3 passes. Do not weaken the production heuristic to satisfy a headless-focus quirk.

- [ ] **Step 4: Commit**

```bash
git add test/e2e/formatting/selection-as-markdown.spec.ts
git commit -m "test: exercise precise-frame context menu path in selection e2e (#258)"
```

---

## Self-Review Notes

- **Spec coverage:** Problem/Goal → Tasks 1+3 (single-frame read, join removed). Trigger paths table → Task 3 (routing), Task 4 (context menu frameId), Task 4 Step 5 (keyboard unchanged). Focus heuristic → Task 1. ScriptingAPI `frameIds` → Task 2. Edge: frameId 0 → Task 3 tests (b/c) + implementation note. Testing section → Tasks 1, 3, 4, 5.
- **frameId 0 trap:** The service branches on `frameId === undefined`, never on falsiness, because `0` is the valid main frame. Covered explicitly by a test and a code comment.
- **Self-contained constraint:** The focus guard is inlined in `selectionToMarkdown` (no imported helper), preserving the "no external function calls" requirement for injected content scripts.
- **Naming consistency:** `onlyIfFocused` (param + arg), `convertSelectionToMarkdown(tab, frameId?)`, `frameIds: [frameId]` used identically across content script, service, type, handler, and tests.
