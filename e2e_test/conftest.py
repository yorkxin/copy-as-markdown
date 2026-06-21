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
from selenium.webdriver.firefox.service import Service as FirefoxService

from dataclasses import dataclass
import os
import shutil
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
        # Wait for the popup to finish rendering before looking for the button.
        # The popup fetches tab data asynchronously, so the buttons may not
        # exist immediately after the page loads.
        wait = WebDriverWait(self.driver, 10)
        btn = wait.until(EC.element_to_be_clickable((By.ID, manifest_key)))
        # Clear the clipboard so Clipboard.poll() detects the new write rather
        # than returning stale content from a previous test action.
        from e2e_test.helpers import Clipboard
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
