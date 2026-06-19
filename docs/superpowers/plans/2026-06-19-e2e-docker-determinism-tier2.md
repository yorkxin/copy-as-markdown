# E2E Docker Determinism — Tier 2: Service-Worker Readiness Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the `tab-exporting` e2e flake (~12–14/137 in Docker at `retries=0`) at its source so the green/red signal is trustworthy in a single pass, instead of being masked by `retries: 2`.

**Architecture:** The flake is an MV3 service-worker readiness race. Tests dispatch `chrome.commands.onCommand.dispatch(...)` the instant they acquire the worker, but `getServiceWorker` only waits for the Chrome API to *exist* (`typeof chrome.commands !== 'undefined'`) — not for our `onCommand`/`onClicked`/`onMessage` listeners to be *registered*. If the dispatch lands before registration, the synthetic event is dropped silently → empty mock clipboard → `waitForMockClipboard` timeout. The window is widened by the first module import being an async-resolved ESM `import '/dist/vendor/browser-polyfill.js'`, and by Docker's slower Chromium. Fix: `background.ts` sets a `__listenersReady` flag synchronously after all top-level `addListener` calls; `getServiceWorker` polls for that flag instead of mere API existence, converting the race into a deterministic wait.

**Tech Stack:** TypeScript, WebExtension MV3 (Chrome service worker), Playwright e2e (`test/e2e/`), esbuild build, Docker (`npm run test:e2e:docker`, runs with `CI=true` after Tier 1).

---

## Background & Constraints

- **MV3 listener rule:** Event listeners must be registered synchronously during initial script evaluation (first event-loop turn) so the idle service worker can be woken by events. All `addListener` calls in `src/background.ts` are already top-level and synchronous (see the comment at `src/background.ts:157` — "All listeners must be registered at top level scope."). Setting a flag immediately after them is therefore a reliable "all listeners wired" signal.
- **SW restart safety:** When Chrome evicts an idle MV3 worker and later restarts it, the module body re-runs, re-registering listeners and re-setting the flag. `getServiceWorker` already re-fetches a fresh worker reference inside its poll loop, so polling the flag stays correct across restarts.
- **The flag must be unconditional** (both Chrome and Firefox builds). It is harmless in Firefox (e2e is Chrome-only) and keeps `background.ts` target-agnostic.
- **Why verification is statistical:** A race fix cannot be proven by one assertion. Determinism is demonstrated by running the previously-flaky specs many times at `retries=0` with zero failures. Tier 1 set `CI=true` (→ `retries: 2`), so verification runs MUST pass `--retries=0` on the CLI to defeat the safety net and observe the true single-pass signal.
- **Run e2e in Docker** (per project convention — the real-clipboard smoke tests hijack the host clipboard). Use the `npm run test:e2e:docker` flow; the container now exits on its own (Tier 1) and writes `test-results/results.json`.

---

## File Structure

- `src/background.ts` (modify): add one synchronous statement at the very end of the module body — `(globalThis as any).__listenersReady = true;` — plus an explanatory comment. This is the single source of the readiness signal.
- `test/e2e/service-worker-readiness.spec.ts` (create): focused regression test asserting the worker exposes `__listenersReady === true` once acquired. Guards against the flag being removed or moved above a listener registration.
- `test/e2e/helpers.ts` (modify): change the `getServiceWorker` poll gate from `hasChromeCommands` to `listenersReady`, keeping the existing API fields for debug visibility and the existing timeout/fresh-worker-refetch behavior.
- `~/.claude/projects/-Users-yorkxin-code-copy-as-markdown/memory/run-e2e-in-docker.md` (modify, final task): update the "pre-existing flaky family" note once the flake is shown to be fixed.

---

### Task 1: Add a `__listenersReady` flag to the service worker

**Files:**
- Create: `test/e2e/service-worker-readiness.spec.ts`
- Modify: `src/background.ts:272-273` (append after the final `refreshMarkdownInstance()` call)

- [ ] **Step 1: Write the failing test**

Create `test/e2e/service-worker-readiness.spec.ts`:

```typescript
/**
 * Regression test for the MV3 service-worker readiness race.
 *
 * background.ts must set globalThis.__listenersReady = true synchronously,
 * AFTER every top-level addListener call. getServiceWorker() gates on this
 * flag so tests never dispatch events before listeners are registered.
 */

import { expect, test } from './fixtures';
import { getServiceWorker } from './helpers';

test.describe('Service worker readiness', () => {
  test('exposes __listenersReady === true once acquired', async ({ context }) => {
    const worker = await getServiceWorker(context);
    const ready = await worker.evaluate(() => (globalThis as any).__listenersReady);
    expect(ready).toBe(true);
  });
});
```

- [ ] **Step 2: Build the test extension and run the test to verify it fails**

Run:

```bash
npm run test:e2e:build
npx playwright test test/e2e/service-worker-readiness.spec.ts --project=parallel-tests --retries=0
```

Expected: FAIL — `expect(ready).toBe(true)` receives `undefined` because `__listenersReady` is not set yet.

- [ ] **Step 3: Set the flag at the end of the background.ts module body**

In `src/background.ts`, the file currently ends at lines 272–273 with:

```typescript
refreshMarkdownInstance()
  .then(() => null /* NOP */);
```

Append, as the final statements of the module:

```typescript
// All MV3 event listeners above are registered synchronously at top-level scope.
// Flip this flag last so e2e's getServiceWorker() can gate on "listeners wired"
// rather than merely "chrome.* API exists" — closing the readiness race where a
// test dispatched an event before onCommand/onClicked/onMessage were registered.
// Re-set on every worker restart because the module body re-runs each time.
(globalThis as any).__listenersReady = true;
```

- [ ] **Step 4: Rebuild and run the test to verify it passes**

Run:

```bash
npm run test:e2e:build
npx playwright test test/e2e/service-worker-readiness.spec.ts --project=parallel-tests --retries=0
```

Expected: PASS.

- [ ] **Step 5: Typecheck and lint**

Run:

```bash
npm run typecheck
npx eslint src/background.ts test/e2e/service-worker-readiness.spec.ts
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/background.ts test/e2e/service-worker-readiness.spec.ts
git commit -m "test(e2e): expose __listenersReady flag from service worker

Set globalThis.__listenersReady = true synchronously after all top-level
addListener calls in background.ts, and add a regression spec asserting it.
This is the readiness signal getServiceWorker will gate on (next task) to
close the MV3 race where a test dispatched an event before listeners were
registered."
```

---

### Task 2: Gate `getServiceWorker` on the readiness flag

**Files:**
- Modify: `test/e2e/helpers.ts:113-128` (the poll loop body and break condition)

- [ ] **Step 1: Replace the API-existence gate with the readiness-flag gate**

In `test/e2e/helpers.ts`, the poll loop currently reads (lines ~113–128):

```typescript
  while (Date.now() - startTime < timeout) {
    const workerState = await extensionWorker.evaluate(() => {
      // In service worker context, use globalThis which has ServiceWorkerGlobalScope
      return {
        readyState: (globalThis as any).registration?.active?.state,
        hasChrome: typeof chrome !== 'undefined',
        hasChromeCommands: typeof chrome?.commands !== 'undefined',
        location: (globalThis as any).location.href,
      };
    });

    // If chrome.commands is available, we're ready
    if (workerState.hasChromeCommands) {
      // Service worker ready with Chrome APIs
      break;
    }
```

Replace it with (adds `listenersReady`, breaks on it instead of `hasChromeCommands`):

```typescript
  while (Date.now() - startTime < timeout) {
    const workerState = await extensionWorker.evaluate(() => {
      // In service worker context, use globalThis which has ServiceWorkerGlobalScope
      return {
        readyState: (globalThis as any).registration?.active?.state,
        hasChrome: typeof chrome !== 'undefined',
        hasChromeCommands: typeof chrome?.commands !== 'undefined',
        // Set last in background.ts, after every top-level addListener call.
        listenersReady: (globalThis as any).__listenersReady === true,
        location: (globalThis as any).location.href,
      };
    });

    // Ready only once our listeners are registered — not merely when the
    // chrome.* API object exists. Closes the dispatch-before-listener race.
    if (workerState.listenersReady) {
      break;
    }
```

- [ ] **Step 2: Update the timeout error message to match the new gate**

In the same file, the post-loop guard currently reads (line ~145):

```typescript
    throw new Error(`Service worker Chrome APIs not ready after ${timeout}ms`);
```

Replace with:

```typescript
    throw new Error(`Service worker listeners not ready (__listenersReady) after ${timeout}ms`);
```

- [ ] **Step 3: Typecheck and lint**

Run:

```bash
npm run typecheck
npx eslint test/e2e/helpers.ts
```

Expected: both exit 0.

- [ ] **Step 4: Determinism check — repeat the readiness spec and the previously-flaky specs at retries=0**

Run (locally is acceptable for these: no real-clipboard smoke is involved — the `formatting/` and readiness specs use the mock clipboard):

```bash
npm run test:e2e:build
npx playwright test \
  test/e2e/service-worker-readiness.spec.ts \
  test/e2e/formatting/tab-exporting-built-in.spec.ts \
  test/e2e/formatting/tab-exporting-custom-format.spec.ts \
  --project=parallel-tests --retries=0 --repeat-each=5
```

Expected: PASS for all repetitions (0 failures). Before this task the same command flakes on the `tab-exporting` specs; after, it is deterministic. If any repetition still fails on a dispatch-before-listener symptom (empty/absent mock clipboard call), STOP and invoke `superpowers:systematic-debugging` — do not paper over it by raising timeouts.

- [ ] **Step 5: Commit**

```bash
git add test/e2e/helpers.ts
git commit -m "test(e2e): gate getServiceWorker on listener readiness, not API existence

Poll for globalThis.__listenersReady instead of typeof chrome.commands.
The old gate returned the worker as soon as the chrome.* API object
existed, before background.ts had registered onCommand/onClicked/onMessage,
so a test could dispatch an event into the void — the tab-exporting flake.
Gating on the readiness flag makes acquisition deterministic."
```

---

### Task 3: Verify in Docker at retries=0 and update the flake note

**Files:**
- Modify: `~/.claude/projects/-Users-yorkxin-code-copy-as-markdown/memory/run-e2e-in-docker.md`

- [ ] **Step 1: Run the FULL suite in Docker at retries=0, three times**

The container runs with `CI=true` (→ `retries: 2`), so override on the CLI to observe the true single-pass signal. Build the image once, then run three times:

```bash
docker build -t copy-as-markdown-playwright -f docker/playwright-ci/Dockerfile .
for i in 1 2 3; do
  echo "=== Docker e2e run $i (retries=0) ==="
  docker run --rm --ipc=host -e CI=true \
    -v "$PWD/test-results:/workspace/test-results" \
    -v "$PWD/playwright-report:/workspace/playwright-report" \
    copy-as-markdown-playwright \
    bash -lc "xvfb-run -a --server-args='-screen 0 1280x720x24 -ac +extension RANDR' npm run test:e2e -- --retries=0"
  echo "run $i exit: $?"
done
```

Expected: all three runs exit 0 with the `tab-exporting` specs passing every time. The container exits on its own (Tier 1 — no blocking HTML server). Parse `test-results/results.json` if a run is non-zero to identify the failing spec.

Note: the `bash -lc "... --retries=0"` form overrides the entrypoint to append the flag. If overriding the entrypoint is awkward in your shell, instead temporarily run `npx playwright test --retries=0` inside an interactive container, or run the non-clipboard subset locally as in Task 2 Step 4 and run the Docker suite once at the default `retries: 2` to confirm green.

- [ ] **Step 2: If all three runs are green, update the memory note**

Edit `~/.claude/projects/-Users-yorkxin-code-copy-as-markdown/memory/run-e2e-in-docker.md`. The note currently ends with:

> Pre-existing flaky family: `tab-exporting` specs fail ~12-14/137 in Docker at retries=0 on master too (CI absorbs via retries=2).

Replace that sentence with:

> Previously-flaky family: `tab-exporting` specs used to fail ~12-14/137 in Docker at retries=0 due to an MV3 service-worker readiness race (tests dispatched events before background.ts registered listeners). Fixed by gating `getServiceWorker` on a `globalThis.__listenersReady` flag set after all top-level addListener calls. As of <DATE>, three Docker runs at retries=0 were clean.

Replace `<DATE>` with today's date. If the runs are NOT clean, leave the note as-is and report the residual failures rather than claiming the flake is fixed.

- [ ] **Step 3: Commit any plan/doc updates**

```bash
git add docs/superpowers/plans/2026-06-19-e2e-docker-determinism-tier2.md
git commit -m "docs: mark tier-2 plan tasks complete"
```

(The memory file lives outside the repo and is not committed.)

---

## Self-Review

- **Spec coverage:** The Tier 2 goal — kill the `tab-exporting` flake at its source — is covered by Task 1 (flag) + Task 2 (gate) + Task 3 (Docker verification at `retries=0`). ✓
- **Type consistency:** The flag name `__listenersReady` and its `=== true` read are identical across `src/background.ts` (Task 1), the readiness spec (Task 1), and `getServiceWorker` (Task 2). The derived `workerState.listenersReady` boolean is the field broken on in Task 2. ✓
- **No placeholders:** Every code step shows the exact code; every run step shows the exact command and expected result. The only intentional fill-in is `<DATE>` in the memory note (Task 3 Step 2), explicitly instructed. ✓
- **Out of scope (intentional):** Does not touch Tier 1 config, does not change `retries` defaults (CI keeps `retries: 2` as a safety net — Tier 2 makes that net non-load-bearing rather than removing it), does not alter extension features or the Firefox build.
