# Playwright E2E Tests for Chrome Extension

This test suite uses Playwright to test the "Copy as Markdown" Chrome extension without GUI automation (no OCR, no PyAutoGUI). Tests trigger extension functionality programmatically and verify clipboard output.

## Test Architecture

```text
Playwright (Node.js)
     ↓
Load Extension in Chromium
     ↓
Page Context ←→ Extension Context
     ↓              ↓
Trigger Action → Background Service Worker
     ↓
Verify Clipboard (via Node.js clipboardy library)
```

## Test Organization

Tests are organized into separate projects based on resource usage:

### UI Tests (`test/e2e/ui/`)

- **Execution**: Run in parallel (up to 4 workers)
- **Tests**: Custom format UI, form validation, preview functionality
- **No shared resources**: These tests don't use the system clipboard

### Clipboard Tests (`test/e2e/clipboard/`)

- **Execution**: Run serially (1 worker only)
- **Tests**: Keyboard shortcuts, custom format keyboard commands
- **Shared resource**: All tests use the system clipboard, which is a singleton

This separation allows UI tests to run quickly in parallel while preventing race conditions in clipboard-dependent tests.

## Test-Specific Extension Build

The tests use a test-specific build of the Chrome extension located in `chrome-test/` (gitignored).

This directory is automatically created by `scripts/build-test-extension.js` which:

1. Copies `chrome/` to `chrome-test/`
2. Modifies `manifest.json` to grant permissions for automated testing

## Running Tests

```bash
# Run all e2e tests (both projects)
npm run test:e2e

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run with UI
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# Run only UI tests (parallel)
npx playwright test --project=ui-tests

# Run only clipboard tests (serial)
npx playwright test --project=clipboard-tests

# List all tests
npx playwright test --list
```

## Writing New Tests

### Fixtures Available

- `context` - Browser context with extension loaded
- `extensionId` - The extension's ID
- `page` - A page in the context

### Choosing Where to Put Tests

**Use `test/e2e/ui/` if:**

- Test doesn't use the system clipboard
- Test is purely UI/DOM interaction
- Can run in parallel with other tests
- Examples: Form validation, preview updates, UI state

**Use `test/e2e/clipboard/` if:**

- Test reads from or writes to the system clipboard
- Test triggers keyboard shortcuts that copy to clipboard
- Requires serial execution to avoid race conditions
- Examples: Keyboard commands, clipboard verification

### Clipboard Access

Tests use the [`clipboardy`](https://www.npmjs.com/package/clipboardy) Node.js library for reliable cross-platform clipboard access:

```typescript
import { resetClipboard, waitForClipboard } from '../helpers';

// Clear clipboard before test
await resetClipboard(page);

// Trigger extension action that copies to clipboard
// ...

// Wait for and verify clipboard content
const clipboardText = await waitForClipboard(page, 5000);
expect(clipboardText).toContain('expected content');
```

**Why clipboardy instead of browser clipboard API?**

- Works regardless of page focus
- Reliable cross-platform (Windows, macOS, Linux)
- No "document not focused" errors
- Direct system clipboard access from Node.js

## Limitations

1. **No native context menu testing** - Browser context menus can't be accessed programmatically
2. **No real keyboard shortcut testing** - We simulate keyboard shortcuts by directly dispatching command events to the service worker
3. **System clipboard is singleton** - Clipboard tests must run serially to avoid race conditions (handled via project configuration)
4. **Extension permissions** - Optional permissions can't be granted in tests since Playwright cannot interact with browser's native UI
5. **Chrome only** - Playwright doesn't play well with Firefox add-ons

## References

- [Playwright Chrome Extensions Docs](https://playwright.dev/docs/chrome-extensions)
- [Chrome Extension Testing Best Practices](https://developer.chrome.com/docs/extensions/mv3/tut_testing/)
- [Chrome Permissions API](https://developer.chrome.com/docs/extensions/reference/api/permissions)
- [clipboardy - Cross-platform clipboard access](https://www.npmjs.com/package/clipboardy)
- [Playwright Multi-Project Setup](https://playwright.dev/docs/test-projects)
