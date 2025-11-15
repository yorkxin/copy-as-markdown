# Python Selenium Suite

Playwright still cannot interact with Firefox extension backgrounds or popup contexts, so we keep a small Selenium suite to cover those Firefox-only scenarios:

- `test_current_tab.py` – keyboard shortcuts and popup flows for current-tab copy (default + custom formats).
- `test_tabs_exporting.py` – keyboard/popup flows for all/highlighted tabs (including grouped tabs and custom formats).

These tests rely on the helper extension and keyboard automation, so they must run in a headed environment.

The keyboard shortcut cases still matter because they validate the `content-script.ts` workarounds for missing user gestures, including the Chrome flow that can prompt for Clipboard Write permission (see <https://github.com/yorkxin/copy-as-markdown/pull/113>).


## Requirements

- Python 3.11+
- Chrome for Testing or Firefox (Selenium downloads chromium automatically)
- The dependencies listed in `requirements.txt`

Install them with:

```shell
pip install -r requirements.txt
```

## Running

From the repository root:

```shell
# Build the extension bundles and test variants (Chrome + Firefox MV3)
npm run compile-chrome
node scripts/build-test-extension.js

# Run the Selenium suite (Chrome + Firefox)
pytest e2e_test
```

The tests open real browser windows, interact with the helper extension, and write to the OS clipboard. Ensure no other global shortcuts conflict with the `Alt+Shift+*` combos defined in `e2e_test/keyboard_shortcuts.py`.
