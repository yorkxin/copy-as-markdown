# Python Selenium Suite

Only one legacy Selenium test remains (`test_tabs_exporting.py`). It exercises tab exporting via the helper extension and relies on keyboard automation, so it still requires a headed browser environment.

The keyboard shortcut tests matter because they validate the `content-script.ts` workarounds for missing user gestures, including the Chrome flow that can prompt for the Clipboard Write permission (see <https://github.com/yorkxin/copy-as-markdown/pull/113>).

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
# Build the extension bundles and test variants (Chrome + Firefox)
npm run compile-chrome && npm run compile-firefox
node scripts/build-test-extension.js

# Run the Selenium test
pytest e2e_test/test_tabs_exporting.py
```

The test opens real browser windows, interacts with the helper extension, and writes to the OS clipboard. Ensure no other global shortcuts conflict with the `Alt+Shift+*` combos used in `e2e_test/keyboard_shortcuts.py`.
