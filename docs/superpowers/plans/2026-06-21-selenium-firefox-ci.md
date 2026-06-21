# Selenium Firefox-only e2e Suite + CI Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip Chrome from the Selenium e2e suite, scope it to Firefox only, prove it runs under `xvfb-run` on Linux, wire it into GitHub Actions CI, and update docs.

**Architecture:** Remove the Chrome branch from `conftest.py`, simplify `BrowserEnvironment` to Firefox-only, add an `xvfb-run` npm script, and add a `selenium` CI job on `ubuntu-latest` that installs Firefox + Python deps and runs `xvfb-run -a pytest e2e_test/`.

**Tech Stack:** Python 3.12, pytest, Selenium WebDriver (Firefox/geckodriver), pyautogui, pyperclip, xvfb-run, xsel, Node 24 (for building extensions).

## Global Constraints

- Firefox only — no Chrome in the Selenium suite (Chrome is covered by Playwright).
- No `--headless` Firefox flag — use `xvfb-run -a` for keyboard-shortcut tests that need a real X11 display.
- Do not modify any test file (`test_current_tab.py`, `test_tabs_exporting.py`, `helpers.py`, `keyboard_shortcuts.py`, `helper_extension/`).
- `requirements.txt` must stay pip-installable without extras.
- CI job depends on the `build` job (same as the `playwright` job).
- Read results from `pytest` stdout directly (no JSON artifact needed for this suite).

---

## File Map

| File | Action | What changes |
|---|---|---|
| `e2e_test/conftest.py` | Modify | Remove Chrome branch, simplify `BrowserEnvironment` to Firefox |
| `requirements.txt` | Modify | Remove `pyshadow` |
| `package.json` | Modify | Add `test:e2e:selenium` script |
| `.github/workflows/nodejs.yml` | Modify | Add `selenium` job |
| `DEVELOPMENT.md` | Modify | Replace "currently broken" Firefox section with current instructions |
| `e2e_test/README.md` | Modify | Update scope + running instructions |

---

## Task 1: Slim down conftest.py to Firefox-only

**Files:**
- Modify: `e2e_test/conftest.py`
- Modify: `requirements.txt`

**What this removes:**
- `from pyshadow.main import Shadow` import
- `os.environ['SE_FORCE_BROWSER_DOWNLOAD'] = 'true'`
- `EXTENSION_PATHS["chrome"]` entry (keep dict but drop `"chrome"` key, or flatten to a single constant)
- `BrowserEnvironment.brand` field and all branches on it
- `BrowserEnvironment.setup_keyboard_shortcuts_chrome()`
- `_find_extension_id_for_chrome()` function
- The `if browser == "chrome":` branch in `browser_environment` fixture
- `params=["chrome","firefox"]` → fixture with no `params` (single browser, no parametrisation)

- [ ] **Step 1: Rewrite `e2e_test/conftest.py`**

Replace the entire file with the following:

```python
import re
import sys
from textwrap import dedent
import time
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.firefox_profile import FirefoxProfile

from dataclasses import dataclass
import os
from typing import List

from e2e_test.keyboard_shortcuts import KeyboardShortcuts

_ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FIREFOX_EXTENSION_PATH = os.path.join(_ROOT_DIR, "firefox-test")
E2E_HELPER_EXTENSION_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "helper_extension")


@dataclass
class CustomFormatConfig:
    context: str
    template: str
    slot: int
    show_in_popup: bool

    def __init__(self, context: str, template: str, slot: int, show_in_popup: bool = False):
        self.context = context
        self.template = template
        self.slot = slot
        self.show_in_popup = show_in_popup


class BrowserEnvironment:
    extension_id: str
    helper_extension_id: str
    driver: webdriver.Firefox
    _extension_base_url: str
    _test_helper_window_handle: str
    _demo_window_handle: str
    _popup_window_handle: str

    def __init__(self, extension_id, helper_extension_id, driver):
        self.extension_id = extension_id
        self.helper_extension_id = helper_extension_id
        self.driver = driver
        self._extension_base_url = f"moz-extension://{extension_id}"

    def options_page_url(self):
        return f"{self._extension_base_url}/dist/static/options.html"

    def custom_format_page_url(self, context: str, slot: int):
        return f"{self._extension_base_url}/dist/static/custom-format.html?context={context}&slot={slot}"

    def popup_url(self, window_id: str, tab_id: str, keep_open: bool = False):
        return f"{self._extension_base_url}/dist/static/popup.html?window={window_id}&tab={tab_id}&keep_open={keep_open and '1' or '0'}"

    def get_window_and_tab_ids(self):
        self.driver.switch_to.window(self._test_helper_window_handle)
        window_id = self.driver.find_element(By.ID, "window-id").get_attribute("value")
        tab_id = self.driver.find_element(By.ID, "tab-0-id").get_attribute("value")
        return window_id, tab_id

    def open_popup(self):
        window_id, tab_id = self.get_window_and_tab_ids()
        self.driver.switch_to.new_window('tab')
        self.driver.get(self.popup_url(window_id, tab_id))
        self._popup_window_handle = self.driver.current_window_handle
        return self._popup_window_handle

    def switch_to_popup(self):
        self.driver.switch_to.window(self._popup_window_handle)

    def close_popup(self):
        self.driver.switch_to.window(self._popup_window_handle)
        self.driver.close()
        self._popup_window_handle = None

    def set_mock_clipboard_mode(self, enabled: bool):
        original_window = self.driver.current_window_handle
        self.driver.switch_to.new_window('tab')
        self.driver.get(self.options_page_url())

        script = """
        const enabled = arguments[0];
        const callback = arguments[arguments.length - 1];
        const msg = { topic: 'set-mock-clipboard', params: { enabled } };
        let entrypoint;
        if (typeof browser !== 'undefined') {
            entrypoint = browser.runtime;
        } else {
            entrypoint = chrome.runtime;
        }

        try {
          entrypoint.sendMessage(msg)
            .then(() => callback(true))
            .catch((error) => callback(error?.message || false));
        } catch (error) {
          callback(error?.message || false);
        }
        """

        result = self.driver.execute_async_script(script, enabled)
        if result is not True:
            raise RuntimeError(f"Failed to set mock clipboard mode: {result}")

        self.driver.close()
        self.driver.switch_to.window(original_window)

    def macro_change_format_style(self, ul_style: str, indent_style: str | None = None):
        original_window = self.driver.current_window_handle
        self.driver.switch_to.new_window('tab')
        self.driver.get(self.options_page_url())

        self.driver.find_element(By.CSS_SELECTOR, f"[name=character][value='{ul_style}']").click()

        if indent_style is not None:
            indent_option = self.driver.find_element(By.CSS_SELECTOR, f"[name=indentation][value='{indent_style}']")
            if indent_option.is_enabled() == False:
                raise ValueError(f"Indentation style {indent_style} cannot be changed")
            indent_option.click()

        self.driver.close()
        self.driver.switch_to.window(original_window)

    def setup_keyboard_shortcuts(self, keyboard_shortcuts: KeyboardShortcuts):
        self.setup_keyboard_shortcuts_firefox(keyboard_shortcuts)

    def setup_keyboard_shortcuts_firefox(self, keyboard_shortcuts: KeyboardShortcuts):
        original_window = self.driver.current_window_handle
        self.driver.switch_to.new_window('tab')
        self.driver.get(self.options_page_url())

        commands = []
        for shortcut in keyboard_shortcuts.items:
            commands.append({
                "name": shortcut.manifest_key,
                "shortcut": shortcut.toFirefoxShortcut()
            })

        script = """
        var callback = arguments[arguments.length - 1];
        var commands = arguments[0];
        Promise.all(commands.map(function(cmd) {
            return browser.commands.update(cmd);
        })).then(function(results) {
            callback(results);
        });
        """

        self.driver.execute_async_script(script, commands)

        self.driver.close()
        self.driver.switch_to.window(original_window)

    def setup_all_custom_formats(self):
        self.macro_setup_custom_formats([
            CustomFormatConfig(context="single-link", template="{{title}},{{url}}", slot=1, show_in_popup=True),
            CustomFormatConfig(context="multiple-links", template=dedent("""
                {{#links}}
                {{number}},'{{title}}','{{url}}'
                {{/links}}
            """).lstrip(), slot=1, show_in_popup=True),
            CustomFormatConfig(context="multiple-links", template=dedent("""
                {{#grouped}}
                {{number}},title='{{title}}',url='{{url}}',isGroup={{isGroup}}
                {{#links}}
                    {{number}},title='{{title}}',url='{{url}}'
                {{/links}}
                {{/grouped}}
            """).lstrip(), slot=2, show_in_popup=True),
        ])

    def macro_setup_custom_formats(self, custom_formats: List[CustomFormatConfig]):
        original_window = self.driver.current_window_handle
        self.driver.switch_to.new_window('tab')

        for fmt in custom_formats:
            self.driver.get(self.custom_format_page_url(fmt.context, fmt.slot))
            textarea = self.driver.find_element(By.ID, "input-template")
            textarea.clear()
            textarea.send_keys(fmt.template)
            show_checkbox = self.driver.find_element(By.ID, "input-show-in-menus")
            if fmt.show_in_popup != show_checkbox.is_selected():
                show_checkbox.click()
            save_button = self.driver.find_element(By.ID, "save")
            save_button.click()

        self.driver.close()
        self.driver.switch_to.window(original_window)

    def trigger_popup_menu(self, manifest_key: str):
        assert self._popup_window_handle, "Popup window not opened"
        original_window = self.driver.current_window_handle
        self.switch_to_popup()
        self.driver.find_element(By.ID, manifest_key).click()
        self.driver.switch_to.window(original_window)

    def select_all(self):
        mod = Keys.COMMAND if sys.platform == 'darwin' else Keys.CONTROL
        self.driver.find_element(By.TAG_NAME, "body").send_keys(mod + "a")

    def open_test_helper_window(self, base_url: str) -> str:
        self.driver.switch_to.new_window('tab')
        self.driver.get(f"moz-extension://{self.helper_extension_id}/main.html?base_url={base_url}")
        self._test_helper_window_handle = self.driver.current_window_handle
        return self._test_helper_window_handle

    def open_demo_window(self) -> str:
        self.driver.switch_to.window(self._test_helper_window_handle)
        self.driver.find_element(By.ID, "open-demo").click()
        wait = WebDriverWait(self.driver, 10)
        wait.until(EC.new_window_is_opened)
        self._demo_window_handle = self.driver.window_handles[-1]
        self.driver.switch_to.window(self._demo_window_handle)
        return self._demo_window_handle

    def switch_to_demo_window(self):
        self.driver.switch_to.window(self._test_helper_window_handle)
        self.driver.find_element(By.ID, "switch-to-demo").click()

    def set_highlighted_tabs(self):
        self.driver.switch_to.window(self._test_helper_window_handle)
        self.driver.find_element(By.ID, "highlight-tabs").click()

    def set_grouped_tabs(self):
        self.driver.switch_to.window(self._test_helper_window_handle)
        self.driver.find_element(By.ID, "group-tabs").click()

    def ungroup_tabs(self):
        self.driver.switch_to.window(self._test_helper_window_handle)
        self.driver.find_element(By.ID, "ungroup-tabs").click()

    def close_demo_window(self):
        self.driver.switch_to.window(self._test_helper_window_handle)
        self.driver.find_element(By.ID, "close-demo").click()
        self._demo_window_handle = None


@pytest.fixture(scope="class")
def browser_environment(request):
    driver = None
    try:
        profile = FirefoxProfile()
        profile.set_preference("intl.accept_languages", "en-US,en")
        profile.set_preference("intl.locale.requested", "en-US")
        profile.set_preference("browser.locale", "en-US")
        profile.set_preference("extensions.webextOptionalPermissionPrompts", False)

        firefox_options = Options()
        firefox_options.profile = profile

        driver = webdriver.Firefox(options=firefox_options)
        driver.install_addon(FIREFOX_EXTENSION_PATH, temporary=True)
        driver.install_addon(E2E_HELPER_EXTENSION_PATH, temporary=True)

        extension_id = _find_extension_id_for_firefox("Copy as Markdown", driver)
        if extension_id is None:
            raise ValueError("Extension ID not found")

        helper_extension_id = _find_extension_id_for_firefox("Copy as Markdown E2E Test Helper", driver)
        if helper_extension_id is None:
            raise ValueError("Helper extension ID not found")

        browser_env = BrowserEnvironment(extension_id, helper_extension_id, driver)
        browser_env.set_mock_clipboard_mode(False)

        yield browser_env
    finally:
        if driver is not None:
            driver.quit()


def _find_extension_id_for_firefox(extension_name: str, driver: webdriver.Firefox):
    assert isinstance(driver, webdriver.Firefox), "This function is only for Firefox"
    driver.get("about:debugging#/runtime/this-firefox")

    my_extension = None
    wait = WebDriverWait(driver, 3)
    wait.until(EC.presence_of_element_located((By.CLASS_NAME, "debug-target-item")))

    extensions = driver.find_elements(By.CLASS_NAME, "debug-target-item")

    for ext in extensions:
        try:
            name = ext.find_element(By.CLASS_NAME, "debug-target-item__name").text
            if name == extension_name:
                my_extension = ext
                break
        except NoSuchElementException:
            continue

    if my_extension is None:
        raise ValueError(f"extension not found: {extension_name}")

    try:
        manifest_link = my_extension.find_element(By.XPATH, ".//a[contains(@href,'moz-extension')]")
    except NoSuchElementException:
        raise RuntimeError("could not find extension ID by looking for a link to manifest.json")

    pattern = r"^moz-extension://([A-Za-z0-9\-]+)/.+$"
    href = manifest_link.get_attribute("href")
    match = re.match(pattern, href)

    if not match:
        raise RuntimeError("could not find extension ID by matching the link to manifest.json")

    return match.group(1)


class FixtureServer:
    def __init__(self):
        self.server = None
        self.server_thread = None
        self.port = None

    @property
    def url(self):
        return f"http://localhost:{self.port}"

    def start(self):
        import http.server
        import threading
        import socket

        fixtures_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'fixtures')

        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('127.0.0.1', 0))
            self.port = s.getsockname()[1]

        self.server = http.server.HTTPServer(("127.0.0.1", self.port),
            lambda *args: http.server.SimpleHTTPRequestHandler(*args, directory=fixtures_dir))
        self.server_thread = threading.Thread(target=self.server.serve_forever)
        self.server_thread.daemon = True
        self.server_thread.start()

    def stop(self):
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            self.server = None
        if self.server_thread:
            self.server_thread.join(timeout=1.0)
            self.server_thread = None

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop()


@pytest.fixture(scope="session")
def fixture_server():
    with FixtureServer() as server:
        yield server
```

- [ ] **Step 2: Remove `pyshadow` from `requirements.txt`**

Replace `requirements.txt` with:

```
selenium
pytest
pyautogui
pyperclip
```

- [ ] **Step 3: Verify collection (no browser launch yet)**

```bash
pip install -r requirements.txt
pytest e2e_test/ --collect-only
```

Expected output — two test classes, no `[chrome]` variants, no import errors:
```
<Class TestCurrentTab>
  <Function test_selection_as_markdown>
  <Function test_current_tab>
  ...
<Class TestTabsExporting>
  <Function test_all_tabs_keyboard_shortcut>
  ...
collected N items
```

- [ ] **Step 4: Commit**

```bash
git add e2e_test/conftest.py requirements.txt
git commit -m "refactor(e2e): scope Selenium suite to Firefox only, remove Chrome"
```

---

## Task 2: Install Firefox and verify the suite runs end-to-end

**Files:** none (environment setup only; any fixes go back to conftest or test infra)

This task proves the suite actually runs. `xvfb-run` and `xsel` are already present in the OrbStack environment (`/usr/bin/xvfb-run`, `/usr/bin/xsel`). Firefox is not — install it first.

- [ ] **Step 1: Install Firefox**

```bash
sudo apt-get update && sudo apt-get install -y firefox
firefox --version
```

Expected: `Mozilla Firefox 1xx.x` (any current release).

- [ ] **Step 2: Build the firefox-test extension**

```bash
npm run test:e2e:build
```

Expected: prints `✓ Built firefox-test` among the output, exits 0.

- [ ] **Step 3: Run the suite under xvfb-run**

```bash
xvfb-run -a --server-args="-screen 0 1280x720x24 -ac +extension RANDR" pytest e2e_test/ -v 2>&1 | tee /tmp/selenium-run.txt
```

Expected: all tests pass. If any fail, move to Step 4.

- [ ] **Step 4: Fix any failures found**

Apply fixes to `e2e_test/conftest.py` (or rarely a test file if there is a genuine bug — do not change test assertions). Re-run Step 3 after each fix until green.

Common failure patterns and fixes:
- **`geckodriver` not found** → `sudo apt-get install -y firefox-geckodriver` (Ubuntu provides it alongside `firefox`)
- **`WebDriverException: Process unexpectedly closed`** → Firefox launched without Xvfb; ensure Step 3 command is used verbatim (the `xvfb-run` wrapper is mandatory)
- **`ValueError: Extension ID not found`** → The extension didn't load. Add a small sleep before `_find_extension_id_for_firefox`:
  ```python
  time.sleep(1)  # give Firefox time to register the addon
  ```
  then retry.
- **`TimeoutError: Clipboard was empty after 3.0 seconds`** → `xsel` not found on `PATH` inside Xvfb session. Verify: `which xsel`. pyperclip uses `xsel` automatically when it is on `PATH`.
- **`RuntimeError: Failed to set mock clipboard mode`** → The extension background isn't ready yet. Wrap the `set_mock_clipboard_mode` call in a retry loop:
  ```python
  for attempt in range(3):
      try:
          browser_env.set_mock_clipboard_mode(False)
          break
      except RuntimeError:
          if attempt == 2:
              raise
          time.sleep(1)
  ```

- [ ] **Step 5: Commit any fixes**

```bash
git add e2e_test/conftest.py
git commit -m "fix(e2e): Firefox Selenium suite runs under xvfb-run on Linux"
```

---

## Task 3: Add npm script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add `test:e2e:selenium` to `package.json`**

Open `package.json` and add inside `"scripts"`:

```json
"test:e2e:selenium": "npm run test:e2e:build && xvfb-run -a --server-args=\"-screen 0 1280x720x24 -ac +extension RANDR\" pytest e2e_test/ -v"
```

- [ ] **Step 2: Smoke-check the script**

```bash
npm run test:e2e:selenium
```

Expected: builds extensions, then runs pytest, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add test:e2e:selenium npm script (Linux/xvfb-run)"
```

---

## Task 4: Add `selenium` CI job

**Files:**
- Modify: `.github/workflows/nodejs.yml`

- [ ] **Step 1: Add the `selenium` job**

Open `.github/workflows/nodejs.yml` and append this job after the `playwright` job:

```yaml
  selenium:
    runs-on: ubuntu-latest
    needs: build
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v6
      - name: Use Node.js
        uses: actions/setup-node@v5
        with:
          node-version-file: ".node-version"
          cache: npm
      - run: npm ci
      - name: Install system dependencies
        run: sudo apt-get update && sudo apt-get install -y firefox xvfb xsel python3-pip
      - name: Install Python dependencies
        run: pip install -r requirements.txt
      - name: Build test extensions
        run: npm run test:e2e:build
      - name: Run Selenium Firefox e2e tests
        run: xvfb-run -a --server-args="-screen 0 1280x720x24 -ac +extension RANDR" pytest e2e_test/ -v
```

- [ ] **Step 2: Lint-check the YAML locally**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/nodejs.yml'))" && echo "YAML OK"
```

Expected: `YAML OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/nodejs.yml
git commit -m "ci: add Selenium Firefox e2e job to GitHub Actions"
```

---

## Task 5: Update documentation

**Files:**
- Modify: `DEVELOPMENT.md`
- Modify: `e2e_test/README.md`

- [ ] **Step 1: Replace the Firefox e2e section in `DEVELOPMENT.md`**

Find the block starting with `### Firefox e2e tests (Python / pytest) — currently broken` and replace it with:

```markdown
### Firefox e2e tests (Python / pytest)

[e2e_test/](e2e_test/) holds a pytest-based suite that drives **Firefox** via Selenium. It covers the hot-path clipboard copy flows (keyboard shortcuts and popup UI) that the Playwright suite cannot reach because Playwright cannot interact with Firefox extension pages.

**Requirements (Linux):**

```sh
sudo apt-get install -y firefox xvfb xsel python3-pip
pip install -r requirements.txt
```

**Run (Linux):**

```sh
npm run test:e2e:selenium
```

This builds the `firefox-test` extension bundle and then runs `pytest e2e_test/ -v` under `xvfb-run`. `xvfb-run` is required — pyautogui sends X11 key events for keyboard-shortcut tests and needs a real (or virtual) display.

**CI:** The `selenium` GitHub Actions job runs this suite natively on `ubuntu-latest` after the `build` job succeeds.

**Docker (coming soon):** A Docker variant (`test:e2e:selenium:docker`) for local Mac parity will be added in a follow-up branch, following the same pattern as `docker/playwright-ci/`.
```

- [ ] **Step 2: Update `e2e_test/README.md`**

Replace the full file with:

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add DEVELOPMENT.md e2e_test/README.md
git commit -m "docs: update Firefox e2e docs — no longer broken, xvfb-run instructions"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Firefox only (remove Chrome) | Task 1 — conftest params removed, Chrome branch deleted |
| `xvfb-run` running mechanism | Task 2 verified, Task 3 npm script |
| CI job on ubuntu-latest after `build` | Task 4 |
| Update DEVELOPMENT.md | Task 5 |
| Update e2e_test/README.md | Task 5 |
| Deferred: Docker | Explicitly deferred in docs (Task 5) |

**Placeholder scan:** None found — all steps contain full code or exact commands.

**Type/name consistency:** `BrowserEnvironment.__init__` takes `(extension_id, helper_extension_id, driver)` in Task 1; the fixture calls `BrowserEnvironment(extension_id, helper_extension_id, driver)` — matches. `FIREFOX_EXTENSION_PATH` defined at module level, used in fixture — matches.
