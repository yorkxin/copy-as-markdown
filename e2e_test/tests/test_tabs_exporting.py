import os
import time
from typing import List
import pyautogui
import pyperclip
from pyshadow.main import Shadow
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from dataclasses import dataclass
import pytest
from textwrap import dedent

from e2e_test.conftest import BrowserEnvironment, FixtureServer
from e2e_test.helpers import Clipboard
from e2e_test.tests.keyboard_setup import setup_keyboard_shortcuts
from e2e_test.tests.keyboard_shortcuts import init_keyboard_shortcuts
from e2e_test.tests.custom_format_setup import setup_all_custom_formats


class TestTabsExporting:
    """Test keyboard shortcuts for the extension"""
    all_keyboard_shortcuts = None
    browser = None
    fixture_server = None
    TAB_LIST_FORMATS = {
        "all-tabs-link-as-list": dedent("""
            - [Page 0 - Copy as Markdown]({url}/0.html)
            - [Page 1 - Copy as Markdown]({url}/1.html)
            - [Page 2 - Copy as Markdown]({url}/2.html)
            - [Page 3 - Copy as Markdown]({url}/3.html)
            - [Page 4 - Copy as Markdown]({url}/4.html)
            - [Page 5 - Copy as Markdown]({url}/5.html)
            - [Page 6 - Copy as Markdown]({url}/6.html)
            - [Page 7 - Copy as Markdown]({url}/7.html)
            """).strip(),
        "all-tabs-link-as-task-list": dedent("""
            - [ ] [Page 0 - Copy as Markdown]({url}/0.html)
            - [ ] [Page 1 - Copy as Markdown]({url}/1.html)
            - [ ] [Page 2 - Copy as Markdown]({url}/2.html)
            - [ ] [Page 3 - Copy as Markdown]({url}/3.html)
            - [ ] [Page 4 - Copy as Markdown]({url}/4.html)
            - [ ] [Page 5 - Copy as Markdown]({url}/5.html)
            - [ ] [Page 6 - Copy as Markdown]({url}/6.html)
            - [ ] [Page 7 - Copy as Markdown]({url}/7.html)
            """).strip(),
        "all-tabs-title-as-list": dedent("""
            - Page 0 - Copy as Markdown
            - Page 1 - Copy as Markdown
            - Page 2 - Copy as Markdown
            - Page 3 - Copy as Markdown
            - Page 4 - Copy as Markdown
            - Page 5 - Copy as Markdown
            - Page 6 - Copy as Markdown
            - Page 7 - Copy as Markdown
            """).strip(),
        "all-tabs-url-as-list": dedent("""
            - {url}/0.html
            - {url}/1.html
            - {url}/2.html
            - {url}/3.html
            - {url}/4.html
            - {url}/5.html
            - {url}/6.html
            - {url}/7.html
            """).strip(),
        "all-tabs-custom-format-1": dedent("""
            1,'Page 0 - Copy as Markdown','{url}/0.html'
            2,'Page 1 - Copy as Markdown','{url}/1.html'
            3,'Page 2 - Copy as Markdown','{url}/2.html'
            4,'Page 3 - Copy as Markdown','{url}/3.html'
            5,'Page 4 - Copy as Markdown','{url}/4.html'
            6,'Page 5 - Copy as Markdown','{url}/5.html'
            7,'Page 6 - Copy as Markdown','{url}/6.html'
            8,'Page 7 - Copy as Markdown','{url}/7.html'
            """).lstrip(),
    }

    HIGHLIGHTED_TABS_FORMATS = {
        "highlighted-tabs-link-as-list": dedent("""
            - [Page 0 - Copy as Markdown]({url}/0.html)
            - [Page 2 - Copy as Markdown]({url}/2.html)
            - [Page 5 - Copy as Markdown]({url}/5.html)
            """).strip(),
        "highlighted-tabs-link-as-task-list": dedent("""
            - [ ] [Page 0 - Copy as Markdown]({url}/0.html)
            - [ ] [Page 2 - Copy as Markdown]({url}/2.html)
            - [ ] [Page 5 - Copy as Markdown]({url}/5.html)
            """).strip(),
        "highlighted-tabs-title-as-list": dedent("""
            - Page 0 - Copy as Markdown
            - Page 2 - Copy as Markdown
            - Page 5 - Copy as Markdown
            """).strip(),
        "highlighted-tabs-url-as-list": dedent("""
            - {url}/0.html
            - {url}/2.html
            - {url}/5.html
            """).strip(),
        "highlighted-tabs-custom-format-1": dedent("""
            1,'Page 0 - Copy as Markdown','{url}/0.html'
            2,'Page 2 - Copy as Markdown','{url}/2.html'
            3,'Page 5 - Copy as Markdown','{url}/5.html'
            """).lstrip(),
    }

    @classmethod
    def setup_class(cls):
        # Initialize all keyboard shortcuts since this test class tests all of them
        cls.all_keyboard_shortcuts = init_keyboard_shortcuts()

    @pytest.fixture(scope="class", autouse=True)
    def setup_browser(self, browser_environment, fixture_server):
        """Setup browser environment for all tests"""
        self.__class__.browser = browser_environment
        self.__class__.fixture_server = fixture_server
        
        # Configure keyboard shortcuts using shared helper
        driver = browser_environment.driver
        original_window = setup_keyboard_shortcuts(driver, self.all_keyboard_shortcuts)

        # Setup custom formats using shared helper
        setup_all_custom_formats(driver, self.__class__.browser._extension_base_url)
        driver.switch_to.window(original_window)

        # Setup tab test environment
        self.__class__.browser.macro_grant_permission("tabs")
        
        # Open test helper window
        self.__class__.browser.open_test_helper_window(self.__class__.fixture_server.url)
        
        # Open demo window which will create the test pages
        self.__class__.browser.open_demo_window()
        
        yield
        
        # Cleanup: close demo window and switch back to test helper window
        if self.__class__.browser._demo_window_handle:
            self.__class__.browser.close_demo_window()

    @pytest.mark.parametrize("manifest_key", [
        "all-tabs-link-as-list",
        "all-tabs-link-as-task-list",
        "all-tabs-title-as-list",
        "all-tabs-url-as-list",
        "all-tabs-custom-format-1",
    ])
    def test_all_tabs_keyboard_shortcut(self, manifest_key: str):
        Clipboard.clear()
        self.__class__.all_keyboard_shortcuts.get_by_manifest_key(manifest_key).press()
        clipboard_text = self.__class__.browser.window.poll_clipboard_content()
        expected_output = self.__class__.TAB_LIST_FORMATS[manifest_key].format(url=self.__class__.fixture_server.url)
        assert clipboard_text == expected_output

    @pytest.mark.parametrize("manifest_key", [
        "highlighted-tabs-link-as-list",
        "highlighted-tabs-link-as-task-list",
        "highlighted-tabs-title-as-list",
        "highlighted-tabs-url-as-list",
        "highlighted-tabs-custom-format-1",
    ])
    def test_highlighted_tabs_keyboard_shortcut(self, manifest_key: str):
        Clipboard.clear()
        # Switch to the test helper window and click the highlight tabs button
        driver = self.__class__.browser.driver
        driver.switch_to.window(self.__class__.browser._test_helper_window_handle)
        highlight_button = driver.find_element(By.ID, "highlight-tabs")
        highlight_button.click()
        
        # Wait a moment for the highlight operation to complete
        time.sleep(1)
        
        # Use the helper extension's button to switch to demo window
        switch_button = driver.find_element(By.ID, "switch-to-demo")
        switch_button.click()
        
        # Press the keyboard shortcut
        self.__class__.all_keyboard_shortcuts.get_by_manifest_key(manifest_key).press()
        clipboard_text = self.__class__.browser.window.poll_clipboard_content()
        expected_output = self.__class__.HIGHLIGHTED_TABS_FORMATS[manifest_key].format(url=self.__class__.fixture_server.url) 
        assert clipboard_text == expected_output
