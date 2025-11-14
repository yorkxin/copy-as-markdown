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
        "current-tab-custom-format-1"
    ])

    @pytest.fixture(scope="class", autouse=True)
    def setup_browser(self, request, browser_environment: BrowserEnvironment, fixture_server: FixtureServer):
        request.cls.browser = browser_environment
        request.cls.fixture_server = fixture_server
        
        self.browser.setup_keyboard_shortcuts(self.all_keyboard_shortcuts)

        # Setup custom formats using shared helper
        self.browser.setup_all_custom_formats()

        # Grant tabs permission
        # XXX: because the popup is using chrome.tabs.query() to get tab with id from parameter,
        # it is necessary to grant the 'tabs' permission. Technically, 'activeTab' is the tab that opens the popup window.
        # In the actual Chrome / Firefox, 'tabs' permission is not required to get title / url of the current tab.
        self.browser.macro_grant_permission("tabs")

        # Open test helper window
        self.browser.open_test_helper_window(self.fixture_server.url)
        
        # Open demo window which will create the test pages
        self.browser.open_demo_window()
        
        yield
        
        if self.browser._demo_window_handle:
            self.browser.close_demo_window()

    def test_selection_as_markdown(self):
        Clipboard.clear()
        # Open selection.html in a new tab
        self.browser.driver.switch_to.new_window('tab')
        selection_tab = self.browser.driver.current_window_handle
        try:
            self.browser.driver.get(self.fixture_server.url + "/selection.html")
            self.browser.select_all()
            self.all_keyboard_shortcuts.get_by_manifest_key("selection-as-markdown").press()
            clipboard_text = self.browser.window.poll_clipboard_content()
            expected_content = open(os.path.join(os.path.dirname(__file__), "..", "fixtures", "selection.md")).read()
            expected_content = expected_content.replace("http://localhost:5566", self.fixture_server.url)
            assert clipboard_text == expected_content
        finally:
            # Close the selection.html tab
            self.browser.driver.switch_to.window(selection_tab)
            self.browser.driver.close()
            # Switch back to the demo window
            self.browser.driver.switch_to.window(self.browser._demo_window_handle)

    def test_current_tab(self):
        Clipboard.clear()
        current_url = self.fixture_server.url
        # Open qa.html in a new tab
        self.browser.driver.switch_to.new_window('tab')
        qa_tab = self.browser.driver.current_window_handle
        try:
            self.browser.driver.get(current_url + "/qa.html")
            self.all_keyboard_shortcuts.get_by_manifest_key("current-tab-link").press()
            clipboard_text = self.browser.window.poll_clipboard_content()
            expected_text = f"[[QA] \\*\\*Hello\\*\\* \\_World\\_]({current_url}/qa.html)"
            assert clipboard_text == expected_text
        finally:
            # Close the qa.html tab
            self.browser.driver.switch_to.window(qa_tab)
            self.browser.driver.close()
            # Switch back to the demo window
            self.browser.driver.switch_to.window(self.browser._demo_window_handle)

    def test_current_tab_custom_format(self):
        """Test copying current tab with a custom format"""
        Clipboard.clear()
        current_url = self.fixture_server.url
        # Open qa.html in a new tab
        self.browser.driver.switch_to.new_window('tab')
        qa_tab = self.browser.driver.current_window_handle
        try:
            self.browser.driver.get(current_url + "/qa.html")
            self.all_keyboard_shortcuts.get_by_manifest_key("current-tab-custom-format-1").press()
            clipboard_text = self.browser.window.poll_clipboard_content()
            expected_text = f"[QA] \\*\\*Hello\\*\\* \\_World\\_,{current_url}/qa.html"
            assert clipboard_text == expected_text
        finally:
            # Close the qa.html tab
            self.browser.driver.switch_to.window(qa_tab)
            self.browser.driver.close()
            # Switch back to the demo window
            self.browser.driver.switch_to.window(self.browser._demo_window_handle)

    def test_popup_current_tab(self):
        """Test copying the current tab to the clipboard from popup menu"""
        expected_text = f"[Page 0 - Copy as Markdown]({self.fixture_server.url}/0.html)"
        self.browser.open_popup()
        self.browser.trigger_popup_menu("current-tab-link")
        clipboard_text = self.browser.window.poll_clipboard_content()
        assert clipboard_text == expected_text

    def test_popup_current_tab_custom_format(self):
        """Test copying the current tab to the clipboard from popup menu with a custom format"""
        expected_text = f"Page 0 - Copy as Markdown,{self.fixture_server.url}/0.html"
        self.browser.open_popup()
        self.browser.trigger_popup_menu("current-tab-custom-format-1")
        clipboard_text = self.browser.window.poll_clipboard_content()
        assert clipboard_text == expected_text
