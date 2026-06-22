# Idea: AT-SPI for Context Menu Testing

## Problem

The extension adds items to Firefox's native right-click context menu. Testing these requires
interacting with a native GTK widget — not a DOM element — which means WebDriver/Selenium
ActionChains cannot reach it.

Approaches tried and rejected:

| Approach | Problem |
|---|---|
| Selenium ActionChains (right-click + key events) | ActionChains operates at the WebDriver/content level; native GTK context menus are not in the DOM |
| Screen OCR (find item by reading pixels) | Brittle: font rendering differences, antialiasing, locale |
| Blind right-click + arrow-key counting | Brittle: item position varies by page type, selection state, Firefox version |
| `xdotool` alone | Can trigger right-click, but cannot read menu item text/position |

## Proposed Solution: AT-SPI

AT-SPI (Assistive Technology Service Provider Interface) is the Linux accessibility bus.
Firefox exposes its full native UI — including context menu items — as an accessibility tree.
The Python `pyatspi` library can walk this tree and find menu items by accessible name,
the same mechanism screen readers use.

```python
import pyatspi

def click_context_menu_item(label: str):
    desktop = pyatspi.Registry.getDesktop(0)
    # find Firefox app
    firefox = next(app for app in desktop if "firefox" in app.name.lower())
    # wait for a menu to appear, find item by name
    menu_item = find_accessible(firefox, role=pyatspi.ROLE_MENU_ITEM, name=label)
    menu_item.queryAction().doAction(0)  # "click"
```

Key properties:
- Finds items by **accessible name** (stable, localisation-independent for extension-defined labels)
- No coordinates — works regardless of where the menu renders on screen
- No pixel reading — works in Xvfb headless environments

## Scope

This approach is **Linux-only**. macOS uses a different accessibility API
(`AXUIElement` via PyObjC). The Selenium Firefox e2e suite is already Docker/Linux-only,
so this is not a constraint in practice.

## What the Dockerfile Needs

```dockerfile
# In the xvfb/xauth/xsel apt block — add:
at-spi2-core
python3-gi          # GObject introspection bindings (pyatspi dependency)
gir1.2-atspi-2.0    # AT-SPI typelib
```

```
# requirements.txt
pyatspi
```

Firefox also needs the accessibility subsystem enabled. Set before launching Firefox:

```bash
export GNOME_ACCESSIBILITY=1
# or set the Firefox profile pref: accessibility.force_disabled = 0
```

## Entrypoint Consideration

AT-SPI requires a D-Bus session bus and the AT-SPI registry daemon to be running before
Firefox starts. In the Docker entrypoint (`run-selenium.sh`), wrap the test run with:

```bash
dbus-run-session -- xvfb-run -a ... python3.14 -m pytest e2e_test/ -v
```

`dbus-run-session` starts a private D-Bus session bus for the duration of the command,
then tears it down cleanly. This is simpler than managing `dbus-daemon` manually.

## Coverage Gaps This Unlocks

From `docs/ideas/e2e-coverage-gaps.md` (on `ideas/e2e-coverage-gaps` branch):

- **Context menu trigger path** — all copy operations triggered via right-click menu
- **Bookmarks context menu** — Firefox-native bookmark items that Playwright cannot emulate
- Any future context menu items added to the extension

## Proof-of-Concept Needed

AT-SPI + Firefox in a headless Xvfb environment has not been validated in this project.
Before committing to this path, a spike is needed to confirm:

1. `dbus-run-session` correctly initialises the AT-SPI registry inside Docker
2. Firefox under Xvfb exposes context menu items in the accessibility tree
3. `pyatspi.Registry.getDesktop(0)` can enumerate the Firefox application

If the accessibility tree is not populated headlessly, `Xvfb` may need the `-ac` flag
(already present) and/or Firefox may need `MOZ_DISABLE_CONTENT_SANDBOX=1`.
