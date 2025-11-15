import os
import pytest
from typing import Optional

from e2e_test.conftest import BrowserEnvironment, FixtureServer
from e2e_test.helpers import Clipboard
from e2e_test.keyboard_shortcuts import init_keyboard_shortcuts


class TestCurrentTab:
    browser: Optional[BrowserEnvironment] = None
    fixture_server: Optional[FixtureServer] = None
    all_keyboard_shortcuts = init_keyboard_shortcuts([
        "selection-as-markdown",
        "current-tab-link",
        "current-tab-custom-format-1",
    ])

    @pytest.fixture(scope="class", autouse=True)
    def setup_browser(self, request, browser_environment: BrowserEnvironment, fixture_server: FixtureServer):
        request.cls.browser = browser_environment
        request.cls.fixture_server = fixture_server

        self.browser.setup_keyboard_shortcuts(self.all_keyboard_shortcuts)
        self.browser.setup_all_custom_formats()

        self.browser.open_test_helper_window(self.fixture_server.url)
        self.browser.open_demo_window()

        yield

        if self.browser._demo_window_handle:
            self.browser.close_demo_window()

    def test_selection_as_markdown(self):
        Clipboard.clear()
        self.browser.driver.switch_to.new_window('tab')
        selection_tab = self.browser.driver.current_window_handle
        try:
            self.browser.driver.get(self.fixture_server.url + "/selection.html")
            self.browser.select_all()
            self.all_keyboard_shortcuts.get_by_manifest_key("selection-as-markdown").press()
            clipboard_text = Clipboard.poll()
            expected_content = open(
                os.path.join(os.path.dirname(__file__), "..", "fixtures", "selection.md"),
            ).read().replace("http://localhost:5566", self.fixture_server.url)
            assert clipboard_text == expected_content
        finally:
            self.browser.driver.switch_to.window(selection_tab)
            self.browser.driver.close()
            self.browser.driver.switch_to.window(self.browser._demo_window_handle)

    def test_current_tab(self):
        Clipboard.clear()
        self.browser.driver.switch_to.new_window('tab')
        qa_tab = self.browser.driver.current_window_handle
        try:
            self.browser.driver.get(self.fixture_server.url + "/qa.html")
            self.all_keyboard_shortcuts.get_by_manifest_key("current-tab-link").press()
            clipboard_text = Clipboard.poll()
            expected_text = f"[[QA] \\*\\*Hello\\*\\* \\_World\\_]({self.fixture_server.url}/qa.html)"
            assert clipboard_text == expected_text
        finally:
            self.browser.driver.switch_to.window(qa_tab)
            self.browser.driver.close()
            self.browser.driver.switch_to.window(self.browser._demo_window_handle)

    def test_current_tab_custom_format(self):
        Clipboard.clear()
        self.browser.driver.switch_to.new_window('tab')
        qa_tab = self.browser.driver.current_window_handle
        try:
            self.browser.driver.get(self.fixture_server.url + "/qa.html")
            self.all_keyboard_shortcuts.get_by_manifest_key("current-tab-custom-format-1").press()
            clipboard_text = Clipboard.poll()
            expected_text = f"[QA] \\*\\*Hello\\*\\* \\_World\\_,{self.fixture_server.url}/qa.html"
            assert clipboard_text == expected_text
        finally:
            self.browser.driver.switch_to.window(qa_tab)
            self.browser.driver.close()
            self.browser.driver.switch_to.window(self.browser._demo_window_handle)

    def test_popup_current_tab(self):
        expected_text = f"[Page 0 - Copy as Markdown]({self.fixture_server.url}/0.html)"
        self.browser.open_popup()
        self.browser.trigger_popup_menu("current-tab-link")
        clipboard_text = Clipboard.poll()
        assert clipboard_text == expected_text

    def test_popup_current_tab_custom_format(self):
        expected_text = f"Page 0 - Copy as Markdown,{self.fixture_server.url}/0.html"
        self.browser.open_popup()
        self.browser.trigger_popup_menu("current-tab-custom-format-1")
        clipboard_text = Clipboard.poll()
        assert clipboard_text == expected_text
