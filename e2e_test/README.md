# Firefox Selenium e2e Suite

Playwright cannot interact with Firefox extension pages (popup, options, background), so this separate pytest suite drives Firefox via Selenium. It covers the hot-path clipboard copy flows: keyboard shortcuts and popup UI for current-tab, all-tabs, and selection-as-markdown operations.

## Scope

- **Browser:** Firefox only (Chrome is covered by the Playwright suite).
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

This builds `firefox-test/` and runs `pytest e2e_test/ -v` under `xvfb-run`. The virtual display is required because pyautogui sends real X11 key events for keyboard-shortcut tests.

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
