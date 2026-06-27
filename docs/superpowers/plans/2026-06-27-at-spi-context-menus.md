# AT-SPI Context Menu Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Linux/Docker-only e2e coverage for the extension's native Firefox context-menu items by reading and clicking them through the AT-SPI accessibility bus.

**Architecture:** A new `e2e_test/atspi_menu.py` helper walks Firefox's AT-SPI accessibility tree (via the GObject-Introspection `Atspi` binding) to find a menu item by accessible name and invoke its "click" action. Selenium's `ActionChains.context_click()` opens the native menu over a real DOM element; AT-SPI then drives the GTK widget that Selenium cannot reach. The Docker entrypoint wraps the run in `dbus-run-session` so the AT-SPI registry exists before Firefox launches.

**Tech Stack:** Python 3.14 (pip-managed in `python:3.14-slim`), PyGObject (`gi.repository.Atspi`), Selenium/geckodriver, Firefox-ESR, Xvfb, D-Bus, pytest.

## Global Constraints

- **Linux/Docker-only.** macOS uses `AXUIElement`; out of scope. `run-selenium.sh` / `docker-e2e.sh` already gate on `uname -s == Linux`.
- **Match accessible names to source verbatim.** Menu labels come from `src/services/context-menu-service.ts` `title:` fields (e.g. `Copy Link as Markdown`, `Copy Image as Markdown`, `Copy Selection as Markdown`, `Copy Bookmark or Folder as Markdown`). Custom-format titles are `Copy Link (<displayName>)` etc.
- **Real system clipboard.** Assert via `e2e_test/helpers.py::Clipboard` (`clear()` then `poll()`), exactly like existing tests. No mock clipboard for these flows.
- **Run pytest under the 3.14 interpreter** invoked as `python` in `run-selenium.sh`. Any AT-SPI binding MUST be importable by that interpreter — not the distro `python3`.
- **Firefox accessibility must be force-enabled** before launch (profile pref `accessibility.force_disabled = 0`, env `GNOME_ACCESSIBILITY=1`).
- Run `npm run typecheck`, `npm run lint`, `npm test` before considering the change complete (per CLAUDE.md). These are unaffected by Python changes but are the project's definition of done.

---

## ⚠️ Critical Risk (read before Task 1)

The spec assumes `pip install pyatspi`. **This will not work as written** in this image:

1. The container runs `python:3.14-slim` — a pip-managed CPython 3.14. The Debian `python3-gi` / `python3-pyatspi` apt packages bind to the *distro* `python3` (3.11/3.12), **not** the 3.14 interpreter that runs pytest. Imports would fail across interpreters.
2. `pyatspi` on PyPI is effectively unmaintained and is a thin wrapper over the GI `Atspi` typelib anyway.

**Decision:** Install **PyGObject via pip into the 3.14 env** (it compiles against the system GI libraries) plus the **`gir1.2-atspi-2.0` typelib** and `at-spi2-core` via apt, then use `from gi.repository import Atspi` directly. The helper adapts the spec's `pyatspi` pseudocode to the `Atspi` API. **Task 0 (spike) exists to prove this end-to-end before any test code is written.** If the spike fails, stop and revisit (fallback: run the AT-SPI portion in a separate distro-`python3` sidecar process that the 3.14 test shells out to).

---

## ✅ Spike Results (Task 0 — run 2026-06-27, aarch64)

All four checks **passed** end-to-end. The risk above is retired.

- **Binding:** `pip install PyGObject` builds a `pygobject-3.56.3-cp314` wheel (+ `pycairo-1.29.0-cp314`) against the system GI libs and imports under Python 3.14. `gi.require_version("Atspi","2.0"); from gi.repository import Atspi; Atspi.init()` works.
- **apt packages (confirmed, exact):** `at-spi2-core dbus libgirepository-2.0-dev gir1.2-atspi-2.0 libcairo2-dev pkg-config gcc`. The `-2.0-dev` variant is correct on this base image (no `1.0` fallback needed).
- **Bus:** `dbus-run-session` auto-activates `org.a11y.Bus` and `org.a11y.atspi.Registry` — no manual `dbus-daemon`/`at-spi-bus-launcher` wrangling. `GNOME_ACCESSIBILITY=1` exported.
- **Tree:** under `xvfb-run`, `Atspi.get_desktop(0)` lists one app, `Firefox`. Selenium `ActionChains.context_click(link).perform()` opens the native menu, whose items appear in the tree as role **`menu item`** with accessible names (`Open Link in New Tab`, `Copy Link`, …).
- **Click action:** the found item reports `get_n_actions() == 1`, action[0] name `"click"`. `Atspi.Action.do_action(item, 0)` returns `True` and **writes the clipboard** (clicking the built-in `Copy Link` left `https://example.com/page` in the X11 clipboard, read back via `xsel -b -o`).
- **API form to use:** `Atspi.Action.do_action(node, index)` (GI form). `Atspi.Action.get_action_name` works but is deprecated — don't depend on it.
- **Residual unknown for Task 3 (not a blocker):** the spike used Firefox's *built-in* link items, which are direct `menu item` children of a `menu` node. When the **extension** is installed with multiple items in one context, Firefox nests them under a `Copy as Markdown` submenu, and GTK may not realize/populate submenu children until the submenu is opened. So `find_menu_item("Copy Link as Markdown")` may need to first locate the `Copy as Markdown` submenu (role `menu`) and `do_action` to open it before the leaf is findable. Confirm and, if needed, add that open-submenu step in Task 2/3 once the real extension is loaded.

---

## File Structure

- `docker/selenium-ci/Dockerfile` — add apt deps (at-spi2-core, dbus, GI build/runtime libs, atspi typelib) and `pip install PyGObject`.
- `docker/selenium-ci/run-selenium.sh` — wrap the pytest run in `dbus-run-session`; export `GNOME_ACCESSIBILITY=1`.
- `requirements.txt` — add `PyGObject`.
- `e2e_test/conftest.py` — set Firefox a11y pref; add a `context_menu_click(...)` method to `BrowserEnvironment`.
- `e2e_test/atspi_menu.py` — **new.** AT-SPI tree walker: `find_menu_item(name, timeout)` and `click_menu_item(name, timeout)`.
- `e2e_test/test_context_menu.py` — **new.** The context-menu tests (link first, then image/selection/bookmark).
- `e2e_test/README.md` — document the AT-SPI flow and its Docker-only nature.

---

## Task 0: Spike — prove AT-SPI works headless in the container ✅ DONE

**Completed 2026-06-27 — all four checks passed. See "Spike Results" above for the confirmed package names, API form, and the one residual submenu-nesting unknown.** The steps below are retained for reproducibility; no need to re-run unless the base image or Firefox-ESR major changes.

**This is a throwaway de-risking task. Produce no committed test code; produce a yes/no answer and the exact working incantations for Tasks 1–4.** Do not proceed past this task until all four checks pass.

**Files:** none committed. Work inside a scratch container shell.

- [ ] **Step 1: Build a throwaway image with the candidate deps**

Create a scratch Dockerfile (in `/tmp`) `FROM python:3.14-slim` mirroring the real one plus:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
      at-spi2-core dbus \
      libgirepository-2.0-dev gir1.2-atspi-2.0 \
      libcairo2-dev pkg-config gcc \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir PyGObject
```

(If `libgirepository-2.0-dev` is unavailable on the base distro, fall back to `libgirepository1.0-dev`. Record which one worked — Task 1 needs the exact name.)

- [ ] **Step 2: Verify the binding imports under 3.14**

Run inside the container:

```bash
python -c "import gi; gi.require_version('Atspi','2.0'); from gi.repository import Atspi; print('Atspi OK', Atspi)"
```

Expected: prints `Atspi OK ...` with no `ValueError`/`ImportError`. **If this fails, STOP** — go to the sidecar fallback noted in the Critical Risk section.

- [ ] **Step 3: Verify Firefox exposes a context menu in the tree, headless**

Inside `dbus-run-session -- xvfb-run -a ...`, launch Firefox-ESR with `accessibility.force_disabled=0` + `GNOME_ACCESSIBILITY=1`, open a page with a link, fire a right-click (via `xdotool` or Selenium `context_click`), then enumerate:

```python
import gi; gi.require_version('Atspi','2.0'); from gi.repository import Atspi
Atspi.init()
desktop = Atspi.get_desktop(0)
for i in range(desktop.get_child_count()):
    app = desktop.get_child_at_index(i)
    print(app.get_name(), app.get_role_name())
```

Expected: a Firefox app node appears; walking it reaches a node with role `menu item` and name `Copy Link as Markdown` (possibly nested under a `Copy as Markdown` submenu — **record the nesting**, Task 3 depends on it).

- [ ] **Step 4: Verify the click action fires the copy**

From the spike script, call `queryAction`/`Atspi.Action.do_action(node, 0)` on the found item and confirm the X11 clipboard (via `xsel`) now holds the markdown link.

Expected: clipboard contains `[<link text>](<url>)`. Record the exact `Atspi` calls that worked — they become the body of `atspi_menu.py` in Task 2.

- [ ] **Step 5: Write findings to the plan**

Append a short "Spike Results" note to this file recording: the exact apt package names, whether items nest under a submenu (and the submenu's accessible name), and the working `Atspi` action call. No commit needed (scratch only), but **do** capture these so Tasks 1–4 use real values, not guesses.

---

## Task 1: Add AT-SPI dependencies to the Docker image and entrypoint

**Files:**
- Modify: `docker/selenium-ci/Dockerfile` (the xvfb/xauth/xsel/xdotool apt block, ~`50-57`; the `pip install` of requirements, ~`64-65`)
- Modify: `docker/selenium-ci/run-selenium.sh:11-12`
- Modify: `requirements.txt`

**Interfaces:**
- Produces: a built image where `python -c "from gi.repository import Atspi"` succeeds and the pytest run executes under a live D-Bus session + AT-SPI registry. Consumed by every later task.

- [ ] **Step 1: Add apt deps to the Dockerfile**

Extend the existing graphical-deps apt block (use the package names confirmed in Task 0):

```dockerfile
# xvfb: headless display   xauth: required by xvfb-run   xsel: real clipboard
# xdotool: X11 key injection for extension keyboard shortcuts
# at-spi2-core + dbus: accessibility bus for native context-menu testing
# GI dev libs + atspi typelib: let pip-built PyGObject bind to Atspi under py3.14
RUN apt-get update && apt-get install -y --no-install-recommends \
      xvfb \
      xauth \
      xsel \
      xdotool \
      at-spi2-core \
      dbus \
      libgirepository-2.0-dev \
      gir1.2-atspi-2.0 \
      libcairo2-dev \
      pkg-config \
      gcc \
    && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 2: Add PyGObject to requirements.txt**

```
selenium
pytest
pyperclip
PyGObject
```

- [ ] **Step 3: Wrap the entrypoint in dbus-run-session + enable a11y**

Edit `run-selenium.sh` so the run is:

```bash
export GNOME_ACCESSIBILITY=1

dbus-run-session -- xvfb-run -a --server-args="-screen 0 1280x720x24 -ac +extension RANDR" \
  python -m pytest e2e_test/ -v
```

- [ ] **Step 4: Build and verify the image imports Atspi and starts a bus**

Run: `docker build -t cam-atspi-check -f docker/selenium-ci/Dockerfile . && docker run --rm cam-atspi-check bash -lc 'dbus-run-session -- python -c "import gi; gi.require_version(\"Atspi\",\"2.0\"); from gi.repository import Atspi; Atspi.init(); print(\"ok\")"'`

(Override entrypoint with `--entrypoint bash` if needed.)
Expected: prints `ok`.

- [ ] **Step 5: Commit**

```bash
git add docker/selenium-ci/Dockerfile docker/selenium-ci/run-selenium.sh requirements.txt
git commit -m "build(e2e): add AT-SPI + D-Bus deps for context-menu testing"
```

---

## Task 2: AT-SPI menu helper module

**Files:**
- Create: `e2e_test/atspi_menu.py`
- Test: covered live in Task 3 (AT-SPI cannot be unit-tested without a running Firefox + bus; there is no meaningful pure-unit seam). The Task 0 spike already validated the API calls.

**Interfaces:**
- Produces:
  - `find_menu_item(name: str, timeout: float = 5.0) -> "Atspi.Accessible"` — polls the desktop tree for a `menu item` accessible whose name equals `name`; raises `TimeoutError` if not found.
  - `click_menu_item(name: str, timeout: float = 5.0) -> None` — finds via `find_menu_item` then invokes action index 0.
- Consumed by: `BrowserEnvironment.context_menu_click` (Task 3).

- [ ] **Step 1: Implement the tree walker**

Use the exact `Atspi` calls confirmed in Task 0. Baseline implementation (adjust submenu handling to Task 0 findings):

```python
import time
import gi

gi.require_version("Atspi", "2.0")
from gi.repository import Atspi  # noqa: E402

Atspi.init()

_MENU_ITEM_ROLE = Atspi.Role.MENU_ITEM


def _iter_descendants(node):
    """Depth-first walk of an accessible subtree."""
    try:
        count = node.get_child_count()
    except Exception:
        return
    for i in range(count):
        child = node.get_child_at_index(i)
        if child is None:
            continue
        yield child
        yield from _iter_descendants(child)


def _find_firefox_app():
    desktop = Atspi.get_desktop(0)
    for i in range(desktop.get_child_count()):
        app = desktop.get_child_at_index(i)
        if app is not None and "firefox" in (app.get_name() or "").lower():
            return app
    return None


def find_menu_item(name: str, timeout: float = 5.0):
    """Poll Firefox's accessibility tree for a menu item with the given name."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        app = _find_firefox_app()
        if app is not None:
            for node in _iter_descendants(app):
                try:
                    if node.get_role() == _MENU_ITEM_ROLE and node.get_name() == name:
                        return node
                except Exception:
                    continue
        time.sleep(0.1)
    raise TimeoutError(f"menu item not found in AT-SPI tree: {name!r}")


def click_menu_item(name: str, timeout: float = 5.0) -> None:
    """Find a menu item by accessible name and invoke its primary action."""
    item = find_menu_item(name, timeout=timeout)
    action = item.queryAction() if hasattr(item, "queryAction") else Atspi.Action
    # GI binding: do_action lives on the Atspi.Action interface.
    Atspi.Action.do_action(item, 0)
```

> Implementation note: in modern PyGObject the action interface is accessed as `Atspi.Action.do_action(node, index)`; the `queryAction()` form is the legacy `pyatspi` API. Use whichever Task 0 proved. If items are nested under a `Copy as Markdown` submenu that must be opened first, add a `find_menu_item(<submenu name>)` + `do_action` call before searching for the leaf, per Task 0's recorded nesting.

- [ ] **Step 2: Commit**

```bash
git add e2e_test/atspi_menu.py
git commit -m "test(e2e): add AT-SPI menu helper for native context menus"
```

---

## Task 3: Wire context-menu trigger into BrowserEnvironment + first test (link)

**Files:**
- Modify: `e2e_test/conftest.py` — add a11y profile pref (~`262-266`) and a `context_menu_click` method on `BrowserEnvironment`.
- Create: `e2e_test/test_context_menu.py`

**Interfaces:**
- Consumes: `e2e_test.atspi_menu.click_menu_item` (Task 2); `BrowserEnvironment.driver`; `Clipboard` (existing).
- Produces: `BrowserEnvironment.context_menu_click(element, menu_label: str) -> None` — right-clicks `element` to open the native menu, then clicks the AT-SPI item named `menu_label`.

- [ ] **Step 1: Enable Firefox accessibility in the profile**

In `conftest.py`'s `browser_environment` fixture, alongside the existing `profile.set_preference(...)` calls, add:

```python
        profile.set_preference("accessibility.force_disabled", 0)
```

- [ ] **Step 2: Add the trigger method to BrowserEnvironment**

```python
    def context_menu_click(self, element, menu_label: str) -> None:
        from selenium.webdriver.common.action_chains import ActionChains
        from e2e_test.atspi_menu import click_menu_item

        ActionChains(self.driver).context_click(element).perform()
        click_menu_item(menu_label)
```

- [ ] **Step 3: Write the failing test (copy link via context menu)**

Create `e2e_test/test_context_menu.py`:

```python
import pytest
from typing import Optional
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from e2e_test.conftest import BrowserEnvironment, FixtureServer
from e2e_test.helpers import Clipboard


class TestContextMenu:
    browser: Optional[BrowserEnvironment] = None
    fixture_server: Optional[FixtureServer] = None

    @pytest.fixture(scope="class", autouse=True)
    @classmethod
    def setup_browser(cls, request, browser_environment: BrowserEnvironment, fixture_server: FixtureServer):
        cls.browser = browser_environment
        cls.fixture_server = fixture_server
        yield

    def test_context_menu_copy_link(self):
        Clipboard.clear()
        self.browser.driver.switch_to.new_window('tab')
        tab = self.browser.driver.current_window_handle
        try:
            self.browser.driver.get(self.fixture_server.url + "/qa.html")
            link = WebDriverWait(self.browser.driver, 10).until(
                EC.element_to_be_clickable((By.TAG_NAME, "a"))
            )
            self.browser.context_menu_click(link, "Copy Link as Markdown")
            clipboard_text = Clipboard.poll()
            assert clipboard_text.startswith("[")
            assert "](" in clipboard_text
        finally:
            self.browser.driver.switch_to.window(tab)
            self.browser.driver.close()
```

> The assertion is shape-based because the exact link text/url depends on the fixture. If `qa.html` has no `<a>`, point the test at a fixture that does (check `fixtures/` for one with a link, e.g. the demo pages) and tighten the assertion to the known `[text](url)` once Task 0/the run confirms the fixture's link.

- [ ] **Step 4: Run the test, expect it to fail first for the right reason**

Run (in Docker — AT-SPI needs the bus): `npm run test:e2e:docker`
Read `test-results/results.json`. Before Tasks 1–2 land it errors on import; after, it should pass. If it fails, it must fail on the assertion or a `TimeoutError` from `find_menu_item` — not on a binding import error.

- [ ] **Step 5: Run the full suite green**

Run: `npm run test:e2e:docker` and confirm `test_context_menu.py::TestContextMenu::test_context_menu_copy_link` passes in `test-results/results.json`, and the existing Selenium tests still pass.

- [ ] **Step 6: Commit**

```bash
git add e2e_test/conftest.py e2e_test/test_context_menu.py
git commit -m "test(e2e): cover Copy Link as Markdown via native context menu"
```

---

## Task 4: Extend coverage — image, selection, bookmark, and docs

**Files:**
- Modify: `e2e_test/test_context_menu.py`
- Modify: `e2e_test/README.md`

**Interfaces:**
- Consumes: `BrowserEnvironment.context_menu_click` (Task 3).

- [ ] **Step 1: Add the image + selection tests**

Append to `TestContextMenu` (use a fixture page containing an `<img>` and selectable text; reuse the `selection.html` fixture the existing suite uses):

```python
    def test_context_menu_copy_image(self):
        Clipboard.clear()
        self.browser.driver.switch_to.new_window('tab')
        tab = self.browser.driver.current_window_handle
        try:
            self.browser.driver.get(self.fixture_server.url + "/selection.html")
            img = WebDriverWait(self.browser.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "img"))
            )
            self.browser.context_menu_click(img, "Copy Image as Markdown")
            clipboard_text = Clipboard.poll()
            assert clipboard_text.startswith("![")
        finally:
            self.browser.driver.switch_to.window(tab)
            self.browser.driver.close()

    def test_context_menu_copy_selection(self):
        Clipboard.clear()
        self.browser.driver.switch_to.new_window('tab')
        tab = self.browser.driver.current_window_handle
        try:
            self.browser.driver.get(self.fixture_server.url + "/selection.html")
            self.browser.select_all()
            body = self.browser.driver.find_element(By.TAG_NAME, "body")
            self.browser.context_menu_click(body, "Copy Selection as Markdown")
            clipboard_text = Clipboard.poll()
            assert clipboard_text != ""
        finally:
            self.browser.driver.switch_to.window(tab)
            self.browser.driver.close()
```

> If `selection.html` has no `<img>`, skip/adjust the image test to a fixture that does, or add a minimal `<img>` to a fixture. Confirm the `Copy Image as Markdown` label still matches `context-menu-service.ts:189`.

- [ ] **Step 2: (Optional, gated on Task 0) Add the bookmark test**

The bookmark menu (`context-menu-service.ts:363`, "Copy Bookmark or Folder as Markdown") appears only in Firefox's bookmark UI, not over a DOM element. Only attempt if Task 0 confirmed AT-SPI can both open the Bookmarks toolbar/manager and right-click a bookmark node. If confirmed, drive it entirely through AT-SPI (no Selenium element). If not, leave a `@pytest.mark.skip(reason="bookmark menu requires AT-SPI-driven bookmark UI; see plan Task 4")` placeholder so the gap is tracked, not silently dropped.

- [ ] **Step 3: Document the flow**

Add a section to `e2e_test/README.md`:

```markdown
## Native context-menu tests (AT-SPI)

`test_context_menu.py` exercises the extension's right-click menu items. The
native GTK menu is not in the DOM, so Selenium opens it with
`ActionChains.context_click()` and `atspi_menu.py` reads/clicks the item via the
AT-SPI accessibility bus (`gi.repository.Atspi`). This requires a D-Bus session
and the AT-SPI registry, so these tests run **only** in Docker, where
`run-selenium.sh` wraps pytest in `dbus-run-session` with `GNOME_ACCESSIBILITY=1`
and Firefox is launched with `accessibility.force_disabled=0`.
```

- [ ] **Step 4: Run the full suite green**

Run: `npm run test:e2e:docker`; confirm all `test_context_menu.py` tests pass via `test-results/results.json` and no existing test regressed.

- [ ] **Step 5: Commit**

```bash
git add e2e_test/test_context_menu.py e2e_test/README.md
git commit -m "test(e2e): cover image/selection context menus + document AT-SPI flow"
```

---

## Self-Review Notes

- **Spec coverage:** Dockerfile apt deps → Task 1. requirements.txt → Task 1. `GNOME_ACCESSIBILITY` / `accessibility.force_disabled` → Tasks 1 & 3. `dbus-run-session` entrypoint → Task 1. `pyatspi` tree-walk PoC → Task 0 + Task 2 (adapted to `Atspi` GI binding — divergence justified in Critical Risk). Coverage gaps unlocked (link/image/selection/bookmark, future items) → Tasks 3 & 4. Proof-of-concept spike → Task 0.
- **Divergence from spec, intentional:** `pip install pyatspi` → `pip install PyGObject` + `gi.repository.Atspi`, because of the 3.14-vs-distro-python binding mismatch. The spec's `pyatspi` pseudocode is preserved in intent (find by accessible name, no coordinates, no pixels).
- **Open items resolved by Task 0 before later tasks hardcode them:** exact GI dev package name (`libgirepository-2.0-dev` vs `1.0`), whether menu items nest under a `Copy as Markdown` submenu, and the precise `Atspi.Action` call form.
