# Firefox Selenium e2e Suite

Playwright cannot interact with Firefox extension pages (popup, options, background), so this separate pytest suite drives Firefox via Selenium. It covers the hot-path clipboard copy flows: keyboard shortcuts and popup UI for current-tab, all-tabs, and selection-as-markdown operations.

## Scope

- **Browser:** primarily Firefox. A small Chrome/Chromium smoke suite
  (`test_chrome_smoke.py`) additionally covers the real keyboard- and
  context-menu → clipboard paths that the Playwright suite can only *simulate*
  (it dispatches `chrome.commands` / `chrome.contextMenus` events directly).
- **Tests:** `test_current_tab.py` — popup + keyboard shortcuts for single-tab copy. `test_tabs_exporting.py` — keyboard/popup flows for all/highlighted/grouped tabs.
- **Clipboard:** real system clipboard (pyperclip via xsel). No mock.

## Requirements

- Python 3.11+
- Firefox
- `xvfb-run` and `xsel` (Linux; provided by `xvfb` and `xsel` apt packages)
- Python packages: `pip install -r requirements.txt`

## Running

From the repository root:

```sh
npm run test:e2e:selenium
```

This builds `firefox-test/` and runs `pytest e2e_test/ -v` under `xvfb-run`. The virtual display is required because `xdotool` sends real X11 key events for keyboard-shortcut tests.

## Native context-menu tests (AT-SPI)

`test_context_menu.py` exercises the extension's right-click menu items. The
native GTK menu is not in the DOM, so Selenium opens it with
`ActionChains.context_click()` and `atspi_menu.py` reads/clicks the item via the
AT-SPI accessibility bus (`gi.repository.Atspi`). This requires a D-Bus session
and the AT-SPI registry, so these tests run **only** in Docker, where
`run-selenium.sh` wraps pytest in `dbus-run-session` with `GNOME_ACCESSIBILITY=1`
and Firefox is launched with `accessibility.force_disabled=0` (scoped to the
`accessible_browser_environment` fixture used by `TestContextMenu`, not applied
globally to every test).

## Chrome smoke tests (`test_chrome_smoke.py`)

The Playwright suite triggers Chrome commands and context menus by dispatching
`chrome.commands.onCommand` / `chrome.contextMenus.onClicked` directly with mocked
payloads — it never exercises the OS keyboard binding or a real right-click. This
suite closes that gap on Chrome:

- **Keyboard:** the four shortcuts the suite uses are bound at load time via
  manifest `suggested_key` (injected by `scripts/build-test-extension.js`, since
  Chrome has no runtime `commands.update()` API). A real `xdotool` keystroke then
  fires the command. Chromium under Xvfb has no window manager, so
  `ChromeBrowserEnvironment.press_shortcut()` sets X input focus on the window first.
- **Context menus:** same `atspi_menu.py` path as Firefox — Selenium opens the
  native menu, AT-SPI clicks the item by accessible name.
- Chromium is launched with `--load-extension`, `--force-renderer-accessibility`
  (so the UI is exposed over AT-SPI) and `--no-sandbox`. Requires the Docker image
  (`chromium` + `chromium-driver`); the module self-skips outside the Docker
  entrypoint, like the AT-SPI tests above.

Note: `test_context_menu_copy_link` asserts the **real** Chrome output
`[(No Title)](about:blank)` — Chrome's `contextMenus` API has no `linkText` and a
bare right-click yields no `selectionText`, so the link title is empty (see the
`TODO` in `src/handlers/context-menu-handler.ts`). The Playwright test hides this
by injecting `selectionText` from the DOM.
