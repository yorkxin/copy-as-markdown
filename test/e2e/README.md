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
Verify Clipboard
```

## Test-Specific Extension Build

The tests use a test-specific build of the Chrome extension located in `chrome-test/` (gitignored).

This directory is automatically created by `scripts/build-test-extension.js` which:

1. Copies `chrome/` to `chrome-test/`
2. Modifies `manifest.json` to grant permissions for automated testing 

## Running Tests

```bash
# Run all e2e tests
npm run test:e2e

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run with UI
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug
```

## Writing New Tests

### Fixtures Available

- `context` - Browser context with extension loaded
- `extensionId` - The extension's ID
- `page` - A page in the context

## Limitations

1. **No native context menu testing** - Browser context menus can't be accessed programmatically
2. **No real keyboard shortcut testing** - Would require OS-level automation
3. **Clipboard API** - Only works on HTTPS pages (or localhost), and must pre-grant `host_permissions` in manifest.json.
4. **Extension permissions** - Optional permissions can't be granted in tests since Playwright cannot interact with browser's native UI.
5. **Chrome only** - Playwright doesn't play well with Firefox add-ons.

## References

- [Playwright Chrome Extensions Docs](https://playwright.dev/docs/chrome-extensions)
- [Chrome Extension Testing Best Practices](https://developer.chrome.com/docs/extensions/mv3/tut_testing/)
- [Chrome Permissions API](https://developer.chrome.com/docs/extensions/reference/api/permissions)
