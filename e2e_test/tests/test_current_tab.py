import os
import time
from dataclasses import dataclass
import pyautogui
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from textwrap import dedent
from pyshadow.main import Shadow
import pytest
from typing import Optional

from e2e_test.conftest import BrowserEnvironment, FixtureServer
from e2e_test.helpers import Clipboard
from e2e_test.tests.keyboard_setup import setup_keyboard_shortcuts
from e2e_test.tests.keyboard_shortcuts import init_keyboard_shortcuts
from e2e_test.tests.custom_format_setup import setup_all_custom_formats, run_test_popup_menu_action


class TestCurrentTab:
    browser: Optional[BrowserEnvironment] = None
    fixture_server: Optional[FixtureServer] = None
    all_keyboard_shortcuts = None

    @classmethod
    def setup_class(cls):
        # Initialize only the current tab related shortcuts
        cls.all_keyboard_shortcuts = init_keyboard_shortcuts([
            "selection-as-markdown",
            "current-tab-link",
            "current-tab-custom-format-1"
        ])

    @pytest.fixture(scope="class", autouse=True)
    def setup_browser(self, browser_environment: BrowserEnvironment, fixture_server: FixtureServer):
        self.__class__.browser = browser_environment
        self.__class__.fixture_server = fixture_server
        
        # Configure keyboard shortcuts using shared helper
        driver = browser_environment.driver
        original_window = setup_keyboard_shortcuts(driver, self.all_keyboard_shortcuts)

        # Setup custom formats using shared helper
        setup_all_custom_formats(driver, self.__class__.browser._extension_base_url)
        driver.switch_to.window(original_window)

        # Grant tabs permission
        # XXX: because the popup is using chrome.tabs.query() to get tab with id from parameter,
        # it is necessary to grant the 'tabs' permission. Technically, 'activeTab' is the tab that opens the popup window.
        # In the actual Chrome / Firefox, 'tabs' permission is not required to get title / url of the current tab.
        self.__class__.browser.macro_grant_permission("tabs")

        # Open test helper window
        self.__class__.browser.open_test_helper_window(self.__class__.fixture_server.url)
        
        # Open demo window which will create the test pages
        self.__class__.browser.open_demo_window()
        
        yield
        
        if self.__class__.browser._demo_window_handle:
            self.__class__.browser.close_demo_window()

    def test_selection_as_markdown(self):
        Clipboard.clear()
        # Open selection.html in a new tab
        self.__class__.browser.driver.switch_to.new_window('tab')
        selection_tab = self.__class__.browser.driver.current_window_handle
        try:
            self.__class__.browser.driver.get(self.__class__.fixture_server.url + "/selection.html")
            self.__class__.browser.select_all()
            self.__class__.all_keyboard_shortcuts.get_by_manifest_key("selection-as-markdown").press()
            clipboard_text = self.__class__.browser.window.poll_clipboard_content()
            expected_content = open(os.path.join(os.path.dirname(__file__), "..", "..", "fixtures", "selection.md")).read()
            expected_content = expected_content.replace("http://localhost:5566", self.__class__.fixture_server.url)
            assert clipboard_text == expected_content
        finally:
            # Close the selection.html tab
            self.__class__.browser.driver.switch_to.window(selection_tab)
            self.__class__.browser.driver.close()
            # Switch back to the demo window
            self.__class__.browser.driver.switch_to.window(self.__class__.browser._demo_window_handle)

    def test_current_tab(self):
        Clipboard.clear()
        current_url = self.__class__.fixture_server.url
        # Open qa.html in a new tab
        self.__class__.browser.driver.switch_to.new_window('tab')
        qa_tab = self.__class__.browser.driver.current_window_handle
        try:
            self.__class__.browser.driver.get(current_url + "/qa.html")
            self.__class__.all_keyboard_shortcuts.get_by_manifest_key("current-tab-link").press()
            clipboard_text = self.__class__.browser.window.poll_clipboard_content()
            expected_text = f"[[QA] \\*\\*Hello\\*\\* \\_World\\_]({current_url}/qa.html)"
            assert clipboard_text == expected_text
        finally:
            # Close the qa.html tab
            self.__class__.browser.driver.switch_to.window(qa_tab)
            self.__class__.browser.driver.close()
            # Switch back to the demo window
            self.__class__.browser.driver.switch_to.window(self.__class__.browser._demo_window_handle)

    def test_current_tab_custom_format(self):
        """Test copying current tab with a custom format"""
        Clipboard.clear()
        current_url = self.__class__.fixture_server.url
        # Open qa.html in a new tab
        self.__class__.browser.driver.switch_to.new_window('tab')
        qa_tab = self.__class__.browser.driver.current_window_handle
        try:
            self.__class__.browser.driver.get(current_url + "/qa.html")
            self.__class__.all_keyboard_shortcuts.get_by_manifest_key("current-tab-custom-format-1").press()
            clipboard_text = self.__class__.browser.window.poll_clipboard_content()
            expected_text = f"[QA] \\*\\*Hello\\*\\* \\_World\\_,{current_url}/qa.html"
            assert clipboard_text == expected_text
        finally:
            # Close the qa.html tab
            self.__class__.browser.driver.switch_to.window(qa_tab)
            self.__class__.browser.driver.close()
            # Switch back to the demo window
            self.__class__.browser.driver.switch_to.window(self.__class__.browser._demo_window_handle)

    def test_popup_current_tab(self):
        """Test copying the current tab to the clipboard from popup menu"""
        expected_text = f"[Page 0 - Copy as Markdown]({self.__class__.fixture_server.url}/0.html)"
        run_test_popup_menu_action(
            self.__class__.browser.driver,
            self.__class__.browser._test_helper_window_handle,
            self.__class__.browser._extension_base_url,
            "current-tab-link",
            expected_text
        )

    def test_popup_current_tab_custom_format(self):
        """Test copying the current tab to the clipboard from popup menu with a custom format"""
        expected_text = f"Page 0 - Copy as Markdown,{self.__class__.fixture_server.url}/0.html"
        run_test_popup_menu_action(
            self.__class__.browser.driver,
            self.__class__.browser._test_helper_window_handle,
            self.__class__.browser._extension_base_url,
            "current-tab-custom-format-1",
            expected_text
        )
