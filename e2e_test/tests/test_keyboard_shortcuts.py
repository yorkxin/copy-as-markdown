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

from e2e_test.conftest import BrowserEnvironment, FixtureServer
from e2e_test.helpers import Clipboard


class TestKeyboardShortcuts:
    """Test keyboard shortcuts for the extension"""
    all_keyboard_shortcuts = None

    @classmethod
    def setup_class(cls):
        cls.all_keyboard_shortcuts = cls._init_keyboard_shortcuts()

    @pytest.fixture(scope="class", autouse=True)
    def setup_keyboard_shortcuts(self, browser_environment):
        """Configure keyboard shortcuts for the extension"""
        print("Setting up keyboard tests...")
        driver = browser_environment.driver
        
        driver.get("chrome://extensions/shortcuts")
        shadow = Shadow(driver)

        for shortcut in self.all_keyboard_shortcuts.items:
            element = shadow.find_element(f"[aria-label=\"Edit shortcut {shortcut.label} for Copy as Markdown\"]")
            driver.execute_script("arguments[0].scrollIntoView(true);", element)
            element.click()
            key = shortcut.keystroke
            actions = ActionChains(driver)
            actions.key_down(Keys.ALT).key_down(Keys.SHIFT).send_keys(key).key_up(Keys.SHIFT).key_up(Keys.ALT).perform()

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

    def test_current_tab(self, browser_environment: BrowserEnvironment, fixture_server: FixtureServer):
        Clipboard.clear()
        browser_environment.driver.get(fixture_server.url + "/qa.html")
        self.__class__.all_keyboard_shortcuts.get_by_manifest_key("current-tab-link").press()
        clipboard_text = browser_environment.window.poll_clipboard_content()
        assert clipboard_text == f"[[QA] \*\*Hello\*\* \_World\_]({fixture_server.url}/qa.html)"

    def test_selection_as_markdown(self, browser_environment: BrowserEnvironment, fixture_server: FixtureServer):
        Clipboard.clear()
        browser_environment.driver.get(fixture_server.url + "/selection.html")
        browser_environment.select_all()
        self.__class__.all_keyboard_shortcuts.get_by_manifest_key("selection-as-markdown").press()
        clipboard_text = browser_environment.window.poll_clipboard_content()
        expected_content = open(os.path.join(os.path.dirname(__file__), "..", "..", "fixtures", "selection.md")).read()
        expected_content = expected_content.replace("http://localhost:5566", fixture_server.url)
        assert clipboard_text == expected_content

    def test_all_tabs(self, browser_environment):
        pass

    def test_highlighted_tabs(self, browser_environment):
        pass


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


