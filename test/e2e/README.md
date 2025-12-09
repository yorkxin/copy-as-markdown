# Playwright E2E Tests for Copy as Markdown

Playwright drives the extension exclusively through Chromium's extension APIs (no OCR or GUI automation). Tests talk directly to the extension's background service worker, so we can trigger commands, open popups, request permissions, and capture clipboard output without manual steps.

## Test Architecture

```text
Playwright (Node.js)
     ↓
chromium.launchPersistentContext(extensionPath)
     ↓
Page Context ←→ Extension Service Worker
     ↓              ↓
Trigger commands → Chrome APIs (tabs, commands, permissions, storage)
     ↓
Clipboard Mode (mock or real OS clipboard)
```

- Manifest V3 extensions only work inside a persistent Chromium context, so every spec shares the same `BrowserContext`.
- The shared service worker fixture exposes helpers that dispatch `chrome.commands.onCommand`, `chrome.contextMenus.onClicked`, etc.
- Clipboard reads/writes are intercepted by a mock service by default and can be switched to the real OS clipboard for smoke coverage.

## Projects & Directories

Everything in `test/e2e` is split by concern, but only the clipboard smoke tests run in their own Playwright project:

| Path | Description | Project |
| --- | --- | --- |
| `ui/` | Popup/options UI flows that never touch the system clipboard | `parallel-tests` |
| `formatting/` | Commands that transform tab/selection data and write to the clipboard | `parallel-tests` |
| `permissions/` | Optional-permission prompts and grant flows | `parallel-tests` |
| `clipboard/` | Minimal smoke tests that must touch the real system clipboard | `clipboard-smoke` |

`parallel-tests` runs everything except `test/e2e/clipboard` with `fullyParallel: true`. `clipboard-smoke` depends on that project, uses one worker, and toggles the background script into "real clipboard" mode before each spec.

## Fixtures & Helpers

`test/e2e/fixtures.ts` extends Playwright's base test with:

- `context`: `chromium.launchPersistentContext` configured with `--disable-extensions-except` so the extension is installed once per project.
- `page`: Convenience accessor to the first tab inside the persistent context.
- `extensionPath`: The path passed to Chromium (`chrome-test/` by default, override per-suite for optional-permission tests).
- `extensionId`: Derived from the service worker URL.
- `serviceWorker`: Waits for the extension's worker and ensures mock clipboard mode is enabled before each test.

## Test Extension Builds

`npm run test:e2e` first runs `npm run compile && node scripts/build-test-extension.js`, which produces:

- `chrome-test/`: Base Chrome build with `tabs`/`tabGroups` moved to required permissions and host permissions for `http://localhost:5566/*`.
- `chrome-optional-test/`: Keeps those permissions optional so `test/e2e/permissions` can validate request flows.
- `firefox-test/`: Maintained for manual experiments, but not exercised in Playwright yet.

Re-run the script anytime the source manifests change.

## Install Dependencies

```bash
npx playwright install-deps
```

On Fedora Linux:

```bash
sudo dnf install -y \
  atk at-spi2-atk cups-libs libdrm libxkbcommon libXcomposite \
  libXdamage libXrandr mesa-libgbm pango cairo alsa-lib \
  liberation-fonts nss gtk3 libxshmfence libX11 libxcb
```

## Install Browsers

```bash
npx playwright install
```

## Running Tests

```bash
# Build all test extensions and run every Playwright project headless
npm run test:e2e

# Headed / inspector variants
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:debug

# Run a specific project
npx playwright test --project=parallel-tests
npx playwright test --project=clipboard-smoke

# List specs
npx playwright test --list
```

`playwright.config.ts` also starts `npx http-server fixtures -p 5566 -c-1` automatically (unless `CI` is set) so HTML fixtures are available.

## Choosing Where To Put New Tests

- Use `test/e2e/ui/` for popup/options UI interactions that never write to the clipboard.
- Use `test/e2e/formatting/` when you need clipboard assertions but can rely on the mock clipboard (most export commands, custom formats, etc.).
- Use `test/e2e/permissions/` for scenarios that must request optional permissions. Set `test.use({ extensionPath: OPTIONAL_EXTENSION_PATH })` and enable permission mocks in `beforeEach`.
- Use `test/e2e/clipboard/` sparingly for high-value smoke coverage that must touch the real system clipboard. These specs toggle mock mode off and run serially.

## Clipboard Modes

- **Mock clipboard (default):** All background writes go through `__mockClipboardService`. Tests inspect it via `waitForMockClipboard` and stay isolated/parallel.
- **System clipboard:** `clipboard/clipboard-smoke.spec.ts` calls `setMockClipboardMode(serviceWorker, false)` and uses OS-specific CLI tools to reset and read the actual system clipboard. Because that resource is global, the suite runs serially with a single worker.

## Permissions Testing

Optional-permission specs combine three pieces:

1. The `chrome-optional-test` build where tabs/tabGroups stay optional.
2. Worker-level overrides installed via `enableMockPermissions` so `chrome.permissions.*` can be called programmatically.
3. Page-level overrides via `injectMockPermissionsIntoPage` so `permissions.html` behaves like Chrome's native bubble.

That setup lets us assert that:

- Running commands without `tabs` opens our in-extension permission prompt and does not touch the clipboard.
- Clicking "Request permission" on `permissions.html` grants `tabs`/`tabGroups` and closes the flow cleanly.

## Limitations

- Native context menus are still inaccessible, so specs dispatch `chrome.contextMenus.onClicked` directly.
- Keyboard shortcuts are simulated via `chrome.commands.onCommand.dispatch` with mocked tab payloads.
- Chrome's real permission bubble is not scriptable; we cover the equivalent UX in our own permission page instead.
- Tests assume the `chromium` channel, because Chrome/Edge remove the flags needed for side-loading MV3 extensions.
- Clipboard smoke tests require platform-specific CLI helpers (`pbcopy/pbpaste`, `wl-copy/wl-paste`, `xsel`, or PowerShell). If none are present the suite will fail fast.

## References

- [Playwright Chrome Extensions Docs](https://playwright.dev/docs/chrome-extensions)
- [Chrome Extension Testing Best Practices](https://developer.chrome.com/docs/extensions/mv3/tut_testing/)
- [Chrome Permissions API](https://developer.chrome.com/docs/extensions/reference/api/permissions)
- [Playwright Multi-Project Setup](https://playwright.dev/docs/test-projects)
