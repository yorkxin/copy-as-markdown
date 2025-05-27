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


class TestKeyboardShortcuts:
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
        cls.all_keyboard_shortcuts = cls._init_keyboard_shortcuts()

    @pytest.fixture(scope="class", autouse=True)
    def setup_browser(self, browser_environment, fixture_server):
        """Setup browser environment for all tests"""
        self.__class__.browser = browser_environment
        self.__class__.fixture_server = fixture_server
        
        # Configure keyboard shortcuts
        print("Setting up keyboard tests...")
        driver = browser_environment.driver
        
        # Store the original window handle
        original_window = driver.current_window_handle
        
        driver.get("chrome://extensions/shortcuts")
        shadow = Shadow(driver)

        for shortcut in self.all_keyboard_shortcuts.items:
            element = shadow.find_element(f"[aria-label=\"Edit shortcut {shortcut.label} for Copy as Markdown\"]")
            driver.execute_script("arguments[0].scrollIntoView(true);", element)
            element.click()
            key = shortcut.keystroke
            actions = ActionChains(driver)
            actions.key_down(Keys.ALT).key_down(Keys.SHIFT).send_keys(key).key_up(Keys.SHIFT).key_up(Keys.ALT).perform()

        # Setup custom formats
        # Single link custom format (slot 1)
        driver.switch_to.new_window('window')
        driver.get(f"{self.__class__.browser._extension_base_url}/dist/ui/custom-format.html?context=single-link&slot=1")
        textarea = driver.find_element(By.TAG_NAME, "textarea")
        textarea.clear()
        textarea.send_keys("{{title}}','{{url}}")
        save_button = driver.find_element(By.ID, "save")
        save_button.click()
        time.sleep(1)
        driver.close()
        driver.switch_to.window(original_window)

        # Multiple links custom format (slot 1)
        driver.switch_to.new_window('window')
        driver.get(f"{self.__class__.browser._extension_base_url}/dist/ui/custom-format.html?context=multiple-links&slot=1")
        textarea = driver.find_element(By.TAG_NAME, "textarea")
        textarea.clear()
        textarea.send_keys(dedent("""
            {{#links}}
            {{number}},'{{title}}','{{url}}'
            {{/links}}
            """).strip())
        save_button = driver.find_element(By.ID, "save")
        save_button.click()
        time.sleep(1)
        driver.close()
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

    @pytest.fixture(scope="class", autouse=True)
    def setup_tab_test_environment(self):
        """Setup environment for tab-related tests"""
        self.__class__.browser.macro_grant_permission("tabs")
        
        # Open test helper window
        self.__class__.browser.open_test_helper_window(self.__class__.fixture_server.url)
        
        # Open demo window which will create the test pages
        self.__class__.browser.open_demo_window()
        
        yield
        
        # Cleanup: close demo window and switch back to test helper window
        if self.__class__.browser._demo_window_handle:
            self.__class__.browser.close_demo_window()

    @classmethod
    def _init_keyboard_shortcuts(cls):
        """Initialize keyboard shortcuts configuration"""
        index_shortcuts = KeyboardShortcuts()
        shortcuts = [
            Shortcut(label="Copy Selection as Markdown", manifest_key="selection-as-markdown", keystroke="1"),
            Shortcut(label="current tab: [title](url)", manifest_key="current-tab-link", keystroke="2"),
            Shortcut(label="current tab: custom format 1", manifest_key="current-tab-custom-format-1", keystroke="3"),
            Shortcut(label="current tab: custom format 2", manifest_key="current-tab-custom-format-2", keystroke="4"),
            Shortcut(label="current tab: custom format 3", manifest_key="current-tab-custom-format-3", keystroke="5"),
            Shortcut(label="current tab: custom format 4", manifest_key="current-tab-custom-format-4", keystroke="6"),
            Shortcut(label="current tab: custom format 5", manifest_key="current-tab-custom-format-5", keystroke="7"),
            Shortcut(label="all tabs: - [title](url)", manifest_key="all-tabs-link-as-list", keystroke="8"),
            Shortcut(label="all tabs: - [ ] [title](url)", manifest_key="all-tabs-link-as-task-list", keystroke="9"),
            Shortcut(label="all tabs: - title", manifest_key="all-tabs-title-as-list", keystroke="q"),
            Shortcut(label="all tabs: - url", manifest_key="all-tabs-url-as-list", keystroke="w"),
            Shortcut(label="selected tabs: - [title](url)", manifest_key="highlighted-tabs-link-as-list", keystroke="e"),
            Shortcut(label="selected tabs: - [ ] [title](url)", manifest_key="highlighted-tabs-link-as-task-list", keystroke="r"),
            Shortcut(label="selected tabs: - title", manifest_key="highlighted-tabs-title-as-list", keystroke="t"),
            Shortcut(label="selected tabs: - url", manifest_key="highlighted-tabs-url-as-list", keystroke="y"),
            Shortcut(label="all tabs: custom format 1", manifest_key="all-tabs-custom-format-1", keystroke="u"),
            Shortcut(label="all tabs: custom format 2", manifest_key="all-tabs-custom-format-2", keystroke="i"),
            Shortcut(label="all tabs: custom format 3", manifest_key="all-tabs-custom-format-3", keystroke="o"),
            Shortcut(label="all tabs: custom format 4", manifest_key="all-tabs-custom-format-4", keystroke="p"),
            Shortcut(label="all tabs: custom format 5", manifest_key="all-tabs-custom-format-5", keystroke="a"),
            Shortcut(label="selected tabs: custom format 1", manifest_key="highlighted-tabs-custom-format-1", keystroke="s"),
            Shortcut(label="selected tabs: custom format 2", manifest_key="highlighted-tabs-custom-format-2", keystroke="d"),
            Shortcut(label="selected tabs: custom format 3", manifest_key="highlighted-tabs-custom-format-3", keystroke="f"),
            Shortcut(label="selected tabs: custom format 4", manifest_key="highlighted-tabs-custom-format-4", keystroke="g"),
            Shortcut(label="selected tabs: custom format 5", manifest_key="highlighted-tabs-custom-format-5", keystroke="h")
        ]

        for shortcut in shortcuts:
            index_shortcuts.append(shortcut)

        return index_shortcuts

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

    @pytest.mark.parametrize("manifest_key", [
        "all-tabs-link-as-list",
        "all-tabs-link-as-task-list",
        "all-tabs-title-as-list",
        "all-tabs-url-as-list",
        "all-tabs-custom-format-1",
    ])
    def test_tab_list_formats(self, manifest_key: str):
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
    def test_highlighted_tabs(self, manifest_key: str):
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
            expected_text = f"[QA] \\*\\*Hello\\*\\* \\_World\\_','{current_url}/qa.html"
            assert clipboard_text == expected_text
        finally:
            # Close the qa.html tab
            self.__class__.browser.driver.switch_to.window(qa_tab)
            self.__class__.browser.driver.close()
            # Switch back to the demo window
            self.__class__.browser.driver.switch_to.window(self.__class__.browser._demo_window_handle)

class KeyboardShortcuts:
    def __init__(self):
        self.items = []
        self.by_label = {}
        self.by_manifest_key = {}

    def append(self, item):
        self.items.append(item)
        self.by_label[item.label] = item
        self.by_manifest_key[item.manifest_key] = item

    def get_by_label(self, label):
        return self.by_label.get(label)

    def get_by_manifest_key(self, manifest_key):
        return self.by_manifest_key.get(manifest_key)


@dataclass
class Shortcut:
    label: str
    manifest_key: str
    keystroke: str

    def press(self):
        with pyautogui.hold('shift'):
            with pyautogui.hold('alt'):
                pyautogui.press(self.keystroke)


