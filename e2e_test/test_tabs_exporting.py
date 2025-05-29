import os
import time
from typing import List, Optional, TypedDict
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

from e2e_test.conftest import BrowserEnvironment, CustomFormatConfig, FixtureServer
from e2e_test.helpers import Clipboard
from e2e_test.keyboard_shortcuts import init_keyboard_shortcuts

class TestTabsExporting:
    """Test keyboard shortcuts for the extension"""
    all_keyboard_shortcuts = None
    browser: Optional[BrowserEnvironment] = None
    fixture_server: Optional[FixtureServer] = None

    ALL_INDENTATION_STYLES = {
        "tab": "\t",
        "spaces": "  ", # two spaces
    }

    ALL_UNORDERED_LIST_STYLES = {
        "dash": "-",
        "asterisk": "*",
        "plus": "+",
    }

    TAB_LIST_FORMATS = {
        "all-tabs-link-as-list": dedent("""
            {prefix} [Page 0 - Copy as Markdown]({url}/0.html)
            {prefix} [Page 1 - Copy as Markdown]({url}/1.html)
            {prefix} [Page 2 - Copy as Markdown]({url}/2.html)
            {prefix} [Page 3 - Copy as Markdown]({url}/3.html)
            {prefix} [Page 4 - Copy as Markdown]({url}/4.html)
            {prefix} [Page 5 - Copy as Markdown]({url}/5.html)
            {prefix} [Page 6 - Copy as Markdown]({url}/6.html)
            {prefix} [Page 7 - Copy as Markdown]({url}/7.html)
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
            """).strip(), # Task List must have - [ ] prefix
        "all-tabs-title-as-list": dedent("""
            {prefix} Page 0 - Copy as Markdown
            {prefix} Page 1 - Copy as Markdown
            {prefix} Page 2 - Copy as Markdown
            {prefix} Page 3 - Copy as Markdown
            {prefix} Page 4 - Copy as Markdown
            {prefix} Page 5 - Copy as Markdown
            {prefix} Page 6 - Copy as Markdown
            {prefix} Page 7 - Copy as Markdown
            """).strip(),
        "all-tabs-url-as-list": dedent("""
            {prefix} {url}/0.html
            {prefix} {url}/1.html
            {prefix} {url}/2.html
            {prefix} {url}/3.html
            {prefix} {url}/4.html
            {prefix} {url}/5.html
            {prefix} {url}/6.html
            {prefix} {url}/7.html
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
            {prefix} [Page 0 - Copy as Markdown]({url}/0.html)
            {prefix} [Page 2 - Copy as Markdown]({url}/2.html)
            {prefix} [Page 5 - Copy as Markdown]({url}/5.html)
            """).strip(),
        "highlighted-tabs-link-as-task-list": dedent("""
            - [ ] [Page 0 - Copy as Markdown]({url}/0.html)
            - [ ] [Page 2 - Copy as Markdown]({url}/2.html)
            - [ ] [Page 5 - Copy as Markdown]({url}/5.html)
            """).strip(), # Task List must have - [ ] prefix
        "highlighted-tabs-title-as-list": dedent("""
            {prefix} Page 0 - Copy as Markdown
            {prefix} Page 2 - Copy as Markdown
            {prefix} Page 5 - Copy as Markdown
            """).strip(),
        "highlighted-tabs-url-as-list": dedent("""
            {prefix} {url}/0.html
            {prefix} {url}/2.html
            {prefix} {url}/5.html
            """).strip(),
        "highlighted-tabs-custom-format-1": dedent("""
            1,'Page 0 - Copy as Markdown','{url}/0.html'
            2,'Page 2 - Copy as Markdown','{url}/2.html'
            3,'Page 5 - Copy as Markdown','{url}/5.html'
            """).lstrip(),
    }

    ALL_TABS_GROUPED_FORMATS = {
        "all-tabs-link-as-list": dedent("""
            {prefix} [Page 0 - Copy as Markdown]({url}/0.html)
            {prefix} Group 1
            {indentation}{prefix} [Page 1 - Copy as Markdown]({url}/1.html)
            {indentation}{prefix} [Page 2 - Copy as Markdown]({url}/2.html)
            {prefix} [Page 3 - Copy as Markdown]({url}/3.html)
            {prefix} [Page 4 - Copy as Markdown]({url}/4.html)
            {prefix} Untitled green group
            {indentation}{prefix} [Page 5 - Copy as Markdown]({url}/5.html)
            {indentation}{prefix} [Page 6 - Copy as Markdown]({url}/6.html)
            {prefix} [Page 7 - Copy as Markdown]({url}/7.html)""").strip(),
        "all-tabs-link-as-task-list": dedent("""
            - [ ] [Page 0 - Copy as Markdown]({url}/0.html)
            - [ ] Group 1
            {indentation}- [ ] [Page 1 - Copy as Markdown]({url}/1.html)
            {indentation}- [ ] [Page 2 - Copy as Markdown]({url}/2.html)
            - [ ] [Page 3 - Copy as Markdown]({url}/3.html)
            - [ ] [Page 4 - Copy as Markdown]({url}/4.html)
            - [ ] Untitled green group
            {indentation}- [ ] [Page 5 - Copy as Markdown]({url}/5.html)
            {indentation}- [ ] [Page 6 - Copy as Markdown]({url}/6.html)
            - [ ] [Page 7 - Copy as Markdown]({url}/7.html)""").strip(), # Task List must have - [ ] prefix
        "all-tabs-title-as-list": dedent("""
            {prefix} Page 0 - Copy as Markdown
            {prefix} Group 1
            {indentation}{prefix} Page 1 - Copy as Markdown
            {indentation}{prefix} Page 2 - Copy as Markdown
            {prefix} Page 3 - Copy as Markdown
            {prefix} Page 4 - Copy as Markdown
            {prefix} Untitled green group
            {indentation}{prefix} Page 5 - Copy as Markdown
            {indentation}{prefix} Page 6 - Copy as Markdown
            {prefix} Page 7 - Copy as Markdown
            """).strip(),
        "all-tabs-url-as-list": dedent("""
            {prefix} {url}/0.html
            {prefix} Group 1
            {indentation}{prefix} {url}/1.html
            {indentation}{prefix} {url}/2.html
            {prefix} {url}/3.html
            {prefix} {url}/4.html
            {prefix} Untitled green group
            {indentation}{prefix} {url}/5.html
            {indentation}{prefix} {url}/6.html
            {prefix} {url}/7.html
            """).strip(),
        "all-tabs-custom-format-2": dedent("""
            1,title='Page 0 - Copy as Markdown',url='{url}/0.html',isGroup=false
            2,title='Group 1',url='',isGroup=true
                1,title='Page 1 - Copy as Markdown',url='{url}/1.html'
                2,title='Page 2 - Copy as Markdown',url='{url}/2.html'
            3,title='Page 3 - Copy as Markdown',url='{url}/3.html',isGroup=false
            4,title='Page 4 - Copy as Markdown',url='{url}/4.html',isGroup=false
            5,title='Untitled green group',url='',isGroup=true
                1,title='Page 5 - Copy as Markdown',url='{url}/5.html'
                2,title='Page 6 - Copy as Markdown',url='{url}/6.html'
            6,title='Page 7 - Copy as Markdown',url='{url}/7.html',isGroup=false
            """).lstrip(),
    }

    HIGHLIGHTED_TABS_GROUPED_FORMATS = {
        "highlighted-tabs-link-as-list": dedent("""
            {prefix} [Page 0 - Copy as Markdown]({url}/0.html)
            {prefix} Group 1
            {indentation}{prefix} [Page 2 - Copy as Markdown]({url}/2.html)
            {prefix} Untitled green group
            {indentation}{prefix} [Page 5 - Copy as Markdown]({url}/5.html)
            """).strip(),
        "highlighted-tabs-link-as-task-list": dedent("""
            - [ ] [Page 0 - Copy as Markdown]({url}/0.html)
            - [ ] Group 1
            {indentation}- [ ] [Page 2 - Copy as Markdown]({url}/2.html)
            - [ ] Untitled green group
            {indentation}- [ ] [Page 5 - Copy as Markdown]({url}/5.html)
            """).strip(), # Task List must have - [ ] prefix
        "highlighted-tabs-title-as-list": dedent("""
            {prefix} Page 0 - Copy as Markdown
            {prefix} Group 1
            {indentation}{prefix} Page 2 - Copy as Markdown
            {prefix} Untitled green group
            {indentation}{prefix} Page 5 - Copy as Markdown
            """).strip(),
        "highlighted-tabs-url-as-list": dedent("""
            {prefix} {url}/0.html
            {prefix} Group 1
            {indentation}{prefix} {url}/2.html
            {prefix} Untitled green group
            {indentation}{prefix} {url}/5.html
            """).strip(),
        "highlighted-tabs-custom-format-2": dedent("""
            1,title='Page 0 - Copy as Markdown',url='{url}/0.html',isGroup=false
            2,title='Group 1',url='',isGroup=true
                1,title='Page 2 - Copy as Markdown',url='{url}/2.html'
            3,title='Untitled green group',url='',isGroup=true
                1,title='Page 5 - Copy as Markdown',url='{url}/5.html'
            """).lstrip(),
    }


    @classmethod
    def setup_class(cls):
        # Initialize all keyboard shortcuts since this test class tests all of them
        cls.all_keyboard_shortcuts = init_keyboard_shortcuts()

    @pytest.fixture(scope="class", autouse=True)
    def setup_browser(self, browser_environment: BrowserEnvironment, fixture_server: FixtureServer):
        """Setup browser environment for all tests"""
        self.__class__.browser = browser_environment
        self.__class__.fixture_server = fixture_server
        
        # Configure keyboard shortcuts using shared helper
        self.__class__.browser.setup_keyboard_shortcuts(self.__class__.all_keyboard_shortcuts)

        # Setup custom formats using shared helper
        self.__class__.browser.setup_all_custom_formats()

        # Setup tab test environment
        self.__class__.browser.macro_grant_permission("tabs")
        self.__class__.browser.macro_grant_permission("tabGroups")
        
        # Open test helper window
        self.__class__.browser.open_test_helper_window(self.__class__.fixture_server.url)

        self.__class__.browser.open_demo_window()
        self.__class__.browser.open_popup()
        
        # Switch to test helper window to set up tabs
        self.browser.driver.switch_to.window(self.browser._test_helper_window_handle)

        yield

        self.__class__.browser.close_popup()
        self.__class__.browser.close_demo_window()
 
    @pytest.mark.parametrize("manifest_key", [
        "all-tabs-link-as-list",
        "all-tabs-link-as-task-list",
        "all-tabs-title-as-list",
        "all-tabs-url-as-list",
        "all-tabs-custom-format-1",
    ])
    def test_all_tabs_keyboard_shortcut(self, manifest_key: str):
        kbd = self.__class__.all_keyboard_shortcuts.get_by_manifest_key(manifest_key)
        expected_format = self.__class__.TAB_LIST_FORMATS[manifest_key]
        for ul_style, prefix in self.__class__.ALL_UNORDERED_LIST_STYLES.items():
            self.__class__.browser.macro_change_unordered_list_prefix_style(ul_style)
            expected_output = expected_format.format(url=self.__class__.fixture_server.url, prefix=prefix)
            
            self.__class__.browser.switch_to_demo_window()

            Clipboard.clear()
            kbd.press()
            clipboard_text = self.__class__.browser.window.poll_clipboard_content()
            assert clipboard_text == expected_output, f"Expected {expected_output} but got {clipboard_text} with {ul_style} prefix"

    @pytest.mark.parametrize("manifest_key", [
        "highlighted-tabs-link-as-list",
        "highlighted-tabs-link-as-task-list",
        "highlighted-tabs-title-as-list",
        "highlighted-tabs-url-as-list",
        "highlighted-tabs-custom-format-1",
    ])
    def test_highlighted_tabs_keyboard_shortcut(self, manifest_key: str):
        kbd = self.__class__.all_keyboard_shortcuts.get_by_manifest_key(manifest_key)
        expected_format = self.__class__.HIGHLIGHTED_TABS_FORMATS[manifest_key]
        self.__class__.browser.set_highlighted_tabs()
        for ul_style, prefix in self.__class__.ALL_UNORDERED_LIST_STYLES.items():
            self.__class__.browser.macro_change_unordered_list_prefix_style(ul_style)
            expected_output = expected_format.format(url=self.__class__.fixture_server.url, prefix=prefix)
            self.__class__.browser.switch_to_demo_window()
            Clipboard.clear()
            kbd.press()
            clipboard_text = self.__class__.browser.window.poll_clipboard_content()
            assert clipboard_text == expected_output, f"Expected {expected_output} but got {clipboard_text} with {ul_style} prefix"

    @pytest.mark.parametrize("manifest_key", [
        "all-tabs-link-as-list",
        "all-tabs-link-as-task-list",
        "all-tabs-title-as-list",
        "all-tabs-url-as-list",
        "all-tabs-custom-format-1",
    ])
    def test_all_tabs_popup_menu(self, manifest_key: str):
        expected_format = self.__class__.TAB_LIST_FORMATS[manifest_key]
        for ul_style, prefix in self.__class__.ALL_UNORDERED_LIST_STYLES.items():
            self.__class__.browser.macro_change_unordered_list_prefix_style(ul_style)
            expected_text = expected_format.format(url=self.__class__.fixture_server.url, prefix=prefix)
            self.__class__.browser.switch_to_demo_window()
            Clipboard.clear()
            self.__class__.browser.trigger_popup_menu(manifest_key)
            clipboard_text = self.__class__.browser.window.poll_clipboard_content()
            assert clipboard_text == expected_text, f"Expected {expected_text} but got {clipboard_text} with {ul_style} prefix"

    @pytest.mark.parametrize("manifest_key", [
        "highlighted-tabs-link-as-list",
        "highlighted-tabs-link-as-task-list",
        "highlighted-tabs-title-as-list",
        "highlighted-tabs-url-as-list",
        "highlighted-tabs-custom-format-1",
    ])
    def test_highlighted_tabs_popup_menu(self, manifest_key: str):
        expected_format = self.__class__.HIGHLIGHTED_TABS_FORMATS[manifest_key]
        self.__class__.browser.set_highlighted_tabs()
        for ul_style, prefix in self.__class__.ALL_UNORDERED_LIST_STYLES.items():
            self.__class__.browser.macro_change_unordered_list_prefix_style(ul_style)
            expected_text = expected_format.format(url=self.__class__.fixture_server.url, prefix=prefix)
            self.__class__.browser.switch_to_demo_window()
            Clipboard.clear()
            self.__class__.browser.trigger_popup_menu(manifest_key)
            clipboard_text = self.__class__.browser.window.poll_clipboard_content()
            assert clipboard_text == expected_text, f"Expected {expected_text} but got {clipboard_text} with {ul_style} prefix"
   
    @pytest.mark.parametrize("manifest_key", [
        "all-tabs-link-as-list",
        "all-tabs-link-as-task-list",
        "all-tabs-title-as-list",
        "all-tabs-url-as-list",
        "all-tabs-custom-format-2",
    ])
    def test_all_tabs_grouped_keyboard_shortcut(self, manifest_key: str):
        kbd = self.__class__.all_keyboard_shortcuts.get_by_manifest_key(manifest_key)
        expected_format = self.__class__.ALL_TABS_GROUPED_FORMATS[manifest_key]
        self.__class__.browser.set_grouped_tabs()
        for ul_style, prefix in self.__class__.ALL_UNORDERED_LIST_STYLES.items():
            self.__class__.browser.macro_change_unordered_list_prefix_style(ul_style)
            for indent_style, indentation in self.__class__.ALL_INDENTATION_STYLES.items():
                self.__class__.browser.macro_change_tab_groups_indentation(indent_style)
                expected_output = expected_format.format(url=self.__class__.fixture_server.url, indentation=indentation, prefix=prefix)
                self.__class__.browser.switch_to_demo_window()
                Clipboard.clear()
                kbd.press()
                clipboard_text = self.__class__.browser.window.poll_clipboard_content()
                assert clipboard_text == expected_output, f"Expected {expected_output} but got {clipboard_text} with {ul_style} prefix and {indent_style} indentation"

    @pytest.mark.parametrize("manifest_key", [
        "highlighted-tabs-link-as-list",
        "highlighted-tabs-link-as-task-list",
        "highlighted-tabs-title-as-list",
        "highlighted-tabs-url-as-list",
        "highlighted-tabs-custom-format-2",
    ])
    def test_highlighted_tabs_grouped_keyboard_shortcut(self, manifest_key: str):
        kbd = self.__class__.all_keyboard_shortcuts.get_by_manifest_key(manifest_key)
        expected_format = self.__class__.HIGHLIGHTED_TABS_GROUPED_FORMATS[manifest_key]
        self.__class__.browser.set_grouped_tabs()
        self.__class__.browser.set_highlighted_tabs()
        for ul_style, prefix in self.__class__.ALL_UNORDERED_LIST_STYLES.items():
            self.__class__.browser.macro_change_unordered_list_prefix_style(ul_style)
            for indent_style, indentation in self.__class__.ALL_INDENTATION_STYLES.items():
                self.__class__.browser.macro_change_tab_groups_indentation(indent_style)
                expected_output = expected_format.format(url=self.__class__.fixture_server.url, indentation=indentation, prefix=prefix)
                self.__class__.browser.switch_to_demo_window()
                Clipboard.clear()
                kbd.press()
                clipboard_text = self.__class__.browser.window.poll_clipboard_content()
                assert clipboard_text == expected_output, f"Expected {expected_output} but got {clipboard_text} with {ul_style} prefix and {indent_style} indentation"

    @pytest.mark.parametrize("manifest_key", [
        "all-tabs-link-as-list",
        "all-tabs-link-as-task-list",
        "all-tabs-title-as-list",
        "all-tabs-url-as-list",
        "all-tabs-custom-format-2",
    ])
    def test_all_tabs_grouped_popup_menu(self, manifest_key: str):
        expected_format = self.__class__.ALL_TABS_GROUPED_FORMATS[manifest_key]
        self.__class__.browser.set_grouped_tabs()
        for ul_style, prefix in self.__class__.ALL_UNORDERED_LIST_STYLES.items():
            self.__class__.browser.macro_change_unordered_list_prefix_style(ul_style)
            for indent_style, indentation in self.__class__.ALL_INDENTATION_STYLES.items():
                self.__class__.browser.macro_change_tab_groups_indentation(indent_style)
                expected_text = expected_format.format(url=self.__class__.fixture_server.url, indentation=indentation, prefix=prefix)
                self.__class__.browser.switch_to_demo_window()
                Clipboard.clear()
                self.__class__.browser.trigger_popup_menu(manifest_key)
                clipboard_text = self.__class__.browser.window.poll_clipboard_content()
                assert clipboard_text == expected_text, f"Expected {expected_text} but got {clipboard_text} with {ul_style} prefix and {indent_style} indentation"

    @pytest.mark.parametrize("manifest_key", [
        "highlighted-tabs-link-as-list",
        "highlighted-tabs-link-as-task-list",
        "highlighted-tabs-title-as-list",
        "highlighted-tabs-url-as-list",
        "highlighted-tabs-custom-format-2",
    ])
    def test_highlighted_tabs_grouped_popup_menu(self, manifest_key: str):
        expected_format = self.__class__.HIGHLIGHTED_TABS_GROUPED_FORMATS[manifest_key]
        self.__class__.browser.set_grouped_tabs()
        self.__class__.browser.set_highlighted_tabs()
        for ul_style, prefix in self.__class__.ALL_UNORDERED_LIST_STYLES.items():
            self.__class__.browser.macro_change_unordered_list_prefix_style(ul_style)
            for indent_style, indentation in self.__class__.ALL_INDENTATION_STYLES.items():
                self.__class__.browser.macro_change_tab_groups_indentation(indent_style)
                expected_text = expected_format.format(url=self.__class__.fixture_server.url, indentation=indentation, prefix=prefix)
                self.__class__.browser.switch_to_demo_window()
                Clipboard.clear()
                self.__class__.browser.trigger_popup_menu(manifest_key)
                clipboard_text = self.__class__.browser.window.poll_clipboard_content()
                assert clipboard_text == expected_text, f"Expected {expected_text} but got {clipboard_text} with {ul_style} prefix and {indent_style} indentation"

    