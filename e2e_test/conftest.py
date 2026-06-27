import re
import sys
from textwrap import dedent
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.firefox_profile import FirefoxProfile
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chrome.service import Service as ChromeService

from dataclasses import dataclass
import os
import shutil
import subprocess
import tempfile
import time
from typing import List

from e2e_test.helpers import Clipboard

_ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FIREFOX_EXTENSION_PATH = os.path.join(_ROOT_DIR, "firefox-test")
CHROME_EXTENSION_PATH = os.path.join(_ROOT_DIR, "chrome-test")
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


class FirefoxBrowserEnvironment:
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

    def wait_until_ready(self, timeout: float = 15.0):
        """Block until the extension's background listeners are registered.

        The smoke suite drives real OS input (keyboard shortcuts, context-menu
        clicks); if one arrives before background.ts has registered
        browser.commands.onCommand / contextMenus.onClicked it is silently
        dropped. background.ts flips globalThis.__listenersReady true at the end of
        its synchronous module body, after every top-level addListener call, so
        that flag is the readiness signal.

        Firefox runs the background as an event page (a real DOM document), so
        from any extension page we can reach the live background object via
        browser.runtime.getBackgroundPage() and read the flag directly — no
        message round-trip, no clipboard mock. (Chrome's service worker has no
        such object; see ChromeBrowserEnvironment.wait_until_ready.)

        The smoke suite asserts against the real system clipboard, which is the
        clipboard service's default (defaultMockState=false), so nothing here
        touches the e2e clipboard mock.
        """
        original_window = self.driver.current_window_handle
        self.driver.switch_to.new_window('tab')
        self.driver.get(self.options_page_url())

        script = """
            const cb = arguments[arguments.length - 1];
            const api = (typeof browser !== 'undefined') ? browser : chrome;
            api.runtime.getBackgroundPage()
              .then(bg => cb(!!(bg && bg.__listenersReady === true)))
              .catch(() => cb(false));
        """
        deadline = time.time() + timeout
        try:
            while time.time() < deadline:
                if self.driver.execute_async_script(script) is True:
                    return
                time.sleep(0.2)
            raise TimeoutError("extension background not ready (__listenersReady not set)")
        finally:
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
        # Wait for the popup to finish rendering before looking for the button.
        # The popup fetches tab data asynchronously, so the buttons may not
        # exist immediately after the page loads.
        wait = WebDriverWait(self.driver, 10)
        btn = wait.until(EC.element_to_be_clickable((By.ID, manifest_key)))
        # Clear the clipboard so Clipboard.poll() detects the new write rather
        # than returning stale content from a previous test action.
        Clipboard.clear()
        btn.click()
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

    def set_grouped_tabs(self):
        self.driver.switch_to.window(self._test_helper_window_handle)
        self.driver.find_element(By.ID, "group-tabs").click()

    def close_demo_window(self):
        self.driver.switch_to.window(self._test_helper_window_handle)
        self.driver.find_element(By.ID, "close-demo").click()
        self._demo_window_handle = None

    def context_menu_click(self, element, menu_label: str) -> None:
        """Right-click *element* to open Firefox's native context menu, then
        invoke the menu item whose accessible name is *menu_label* via AT-SPI."""
        from selenium.webdriver.common.action_chains import ActionChains
        from selenium.webdriver.common.keys import Keys
        from e2e_test.atspi_menu import click_menu_item

        ActionChains(self.driver).context_click(element).perform()
        try:
            click_menu_item(menu_label)
        except Exception:
            # Dismiss the still-open native menu so it cannot bleed into the
            # next test (the browser is class-scoped and shared across tests).
            ActionChains(self.driver).send_keys(Keys.ESCAPE).perform()
            raise


class ChromeBrowserEnvironment:
    """Minimal Chrome/Chromium environment for the real-input smoke tests.

    Only what the smoke paths need: real keystrokes (xdotool, after focusing the
    window — there is no window manager under Xvfb) and native context menus
    (Selenium right-click + AT-SPI), plus a readiness gate that pings the
    background before tests run. No popup/helper-extension wiring.
    """

    def __init__(self, driver):
        self.driver = driver

    def focus_window(self):
        # No window manager under Xvfb, so set X input focus on the Chromium
        # window explicitly before injecting keys with xdotool.
        subprocess.run(
            ["xdotool", "search", "--sync", "--onlyvisible", "--class", "chromium",
             "windowfocus"],
            check=False,
        )

    def press_shortcut(self, keystroke: str):
        self.focus_window()
        time.sleep(0.3)
        subprocess.run(
            ["xdotool", "key", "--clearmodifiers", f"alt+shift+{keystroke}"],
            check=False,
        )

    def select_all(self):
        self.driver.find_element(By.TAG_NAME, "body").send_keys(Keys.CONTROL + "a")

    def wait_until_ready(self, timeout: float = 15.0):
        """Block until the extension's background listeners are registered.

        background.ts flips globalThis.__listenersReady true at the end of its
        synchronous module body, after every top-level addListener call; until
        then a keyboard shortcut or context-menu click would be silently dropped.

        Chrome runs the background as a service worker, which has no navigable page
        and cannot be flag-read over CDP (attaching a debugger pauses the worker,
        so the flag never reads true). The robust signal is a message round-trip:
        the e2e-only 'e2e-listeners-ready' handler answers with __listenersReady,
        and reaching that handler at all already proves the module body ran
        (onMessage is registered in the same pass as onCommand / onClicked). The
        smoke suite asserts the real system clipboard, the clipboard service's
        default, so nothing here touches the e2e clipboard mock.
        """
        deadline = time.time() + timeout

        # The extension id is the host of its service worker target (found via CDP).
        extension_id = None
        while time.time() < deadline and extension_id is None:
            targets = self.driver.execute_cdp_cmd("Target.getTargets", {}).get("targetInfos", [])
            for target in targets:
                url = target.get("url", "")
                if target.get("type") == "service_worker" and url.startswith("chrome-extension://"):
                    extension_id = url.split("/")[2]
                    break
            if extension_id is None:
                time.sleep(0.2)
        if extension_id is None:
            raise TimeoutError("extension service worker not found via CDP")

        # From an extension page, poll the readiness handler until it reports the
        # background's listeners are wired.
        self.driver.get(f"chrome-extension://{extension_id}/dist/static/options.html")
        ping = """
            const cb = arguments[arguments.length - 1];
            chrome.runtime.sendMessage({ topic: 'e2e-listeners-ready', params: {} })
                .then(r => cb(!!(r && r.listenersReady === true)))
                .catch(() => cb(false));
        """
        while time.time() < deadline:
            try:
                if self.driver.execute_async_script(ping) is True:
                    return
            except Exception:
                pass
            time.sleep(0.2)
        raise TimeoutError("extension background not ready (__listenersReady not set)")

    def context_menu_click(self, element, menu_label: str) -> None:
        """Right-click *element* to open Chrome's native context menu, then invoke
        the menu item whose accessible name is *menu_label* via AT-SPI."""
        from selenium.webdriver.common.action_chains import ActionChains
        from e2e_test.atspi_menu import click_menu_item

        ActionChains(self.driver).context_click(element).perform()
        try:
            click_menu_item(menu_label)
        except Exception:
            ActionChains(self.driver).send_keys(Keys.ESCAPE).perform()
            raise


def _browser_environment(force_accessibility: bool):
    driver = None
    try:
        profile = FirefoxProfile()
        profile.set_preference("intl.accept_languages", "en-US,en")
        profile.set_preference("intl.locale.requested", "en-US")
        profile.set_preference("browser.locale", "en-US")
        profile.set_preference("extensions.webextOptionalPermissionPrompts", False)
        if force_accessibility:
            # Enable Firefox's accessibility engine so the native context menu is
            # exposed via AT-SPI (see e2e_test/atspi_menu.py). Scoped to context-
            # menu tests only: it slows Firefox enough to flake timing-sensitive
            # tests, so the default fixture leaves it off.
            profile.set_preference("accessibility.force_disabled", 0)

        firefox_options = Options()
        firefox_options.profile = profile

        # Explicitly locate geckodriver so Selenium Manager is not invoked.
        # Selenium Manager does not support linux/aarch64 and will raise
        # WebDriverException on ARM-based Linux hosts (e.g. OrbStack on Apple
        # Silicon).  Passing the path via FirefoxService bypasses that look-up.
        geckodriver_path = shutil.which("geckodriver")
        if geckodriver_path is None:
            raise RuntimeError("geckodriver not found on PATH; install it (e.g. apt install firefox-geckodriver)")
        firefox_service = FirefoxService(executable_path=geckodriver_path)

        driver = webdriver.Firefox(options=firefox_options, service=firefox_service)
        driver.install_addon(FIREFOX_EXTENSION_PATH, temporary=True)
        driver.install_addon(E2E_HELPER_EXTENSION_PATH, temporary=True)

        extension_id = _find_extension_id_for_firefox("Copy as Markdown", driver)
        if extension_id is None:
            raise ValueError("Extension ID not found")

        helper_extension_id = _find_extension_id_for_firefox("Copy as Markdown E2E Test Helper", driver)
        if helper_extension_id is None:
            raise ValueError("Helper extension ID not found")

        browser_env = FirefoxBrowserEnvironment(extension_id, helper_extension_id, driver)
        # Gate on background readiness (__listenersReady) before any test fires a
        # keyboard shortcut or context-menu click. The smoke suite asserts the real
        # system clipboard, which is the clipboard service's default.
        browser_env.wait_until_ready()

        yield browser_env
    finally:
        if driver is not None:
            driver.quit()


@pytest.fixture(scope="class")
def browser_environment(request):
    yield from _browser_environment(force_accessibility=False)


@pytest.fixture(scope="class")
def accessible_browser_environment(request):
    yield from _browser_environment(force_accessibility=True)


def _chrome_browser_environment():
    driver = None
    try:
        chromium_bin = (shutil.which("chromium")
                        or shutil.which("chromium-browser")
                        or shutil.which("google-chrome"))
        chromedriver_path = shutil.which("chromedriver")
        if chromium_bin is None or chromedriver_path is None:
            pytest.skip("chromium/chromedriver not found on PATH")

        options = ChromeOptions()
        options.binary_location = chromium_bin
        # Load the unpacked MV3 test extension. The second flag re-enables
        # --load-extension, which recent Chromium disables by default.
        options.add_argument(f"--load-extension={CHROME_EXTENSION_PATH}")
        options.add_argument("--disable-features=DisableLoadExtensionCommandLineSwitch")
        # Expose the browser UI (including native context menus) over AT-SPI.
        options.add_argument("--force-renderer-accessibility")
        # Even as the non-root `appuser`, Chromium's namespace sandbox does not
        # work in this container (no unprivileged user namespaces), so it still
        # needs --no-sandbox. The container itself is the isolation boundary.
        options.add_argument("--no-sandbox")
        options.add_argument("--no-first-run")
        options.add_argument("--no-default-browser-check")
        options.add_argument(f"--user-data-dir={tempfile.mkdtemp(prefix='chrome-e2e-')}")
        # NOT headless: native context menus need a real (Xvfb) window.

        service = ChromeService(executable_path=chromedriver_path)
        driver = webdriver.Chrome(options=options, service=service)
        env = ChromeBrowserEnvironment(driver)
        # Wait for the background listeners to be registered (the __listenersReady
        # proxy) instead of a blind sleep.
        env.wait_until_ready()
        yield env
    finally:
        if driver is not None:
            driver.quit()


@pytest.fixture(scope="class")
def chrome_browser_environment(request):
    yield from _chrome_browser_environment()


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
    # Use get_dom_attribute() instead of get_attribute() because the latter
    # internally calls execute_script(), which is forbidden on privileged
    # parent-process pages like about:debugging (raises
    # "UnsupportedOperationError: ExecuteScript … not supported for parent
    # process browsing contexts").
    href = manifest_link.get_dom_attribute("href")
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
