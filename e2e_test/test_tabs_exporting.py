from typing import Optional
import pytest
from textwrap import dedent

from e2e_test.conftest import BrowserEnvironment, FixtureServer
from e2e_test.helpers import Clipboard
from e2e_test.keyboard_shortcuts import init_keyboard_shortcuts

class TestTabsExporting:
    """Test keyboard shortcuts for the extension"""
    all_keyboard_shortcuts = init_keyboard_shortcuts()
    browser: Optional[BrowserEnvironment] = None
    fixture_server: Optional[FixtureServer] = None

    EXPECTED_TABS_LIST = dedent("""
        - [Page 0 - Copy as Markdown]({url}/0.html)
        - [Page 1 - Copy as Markdown]({url}/1.html)
        - [Page 2 - Copy as Markdown]({url}/2.html)
        - [Page 3 - Copy as Markdown]({url}/3.html)
        - [Page 4 - Copy as Markdown]({url}/4.html)
        - [Page 5 - Copy as Markdown]({url}/5.html)
        - [Page 6 - Copy as Markdown]({url}/6.html)
        - [Page 7 - Copy as Markdown]({url}/7.html)
        """).strip()

    @pytest.fixture(scope="class", autouse=True)
    def setup_browser(self, request, browser_environment: BrowserEnvironment, fixture_server: FixtureServer):
        """Setup browser environment for all tests"""
        # request.cls.all_keyboard_shortcuts = init_keyboard_shortcuts()
        request.cls.browser = browser_environment
        request.cls.fixture_server = fixture_server
        
        # Configure keyboard shortcuts using shared helper
        self.browser.setup_keyboard_shortcuts(self.all_keyboard_shortcuts)

        # Setup custom formats using shared helper
        self.browser.setup_all_custom_formats()

        # Open test helper window
        self.browser.open_test_helper_window(self.fixture_server.url)

        self.browser.open_demo_window()
        self.browser.open_popup()
        
        # Switch to test helper window to set up tabs
        self.browser.driver.switch_to.window(self.browser._test_helper_window_handle)

        yield

        self.browser.close_popup()
        self.browser.close_demo_window()
 
    @pytest.fixture(scope="class")
    def set_default_format_style(self):
        self.browser.macro_change_format_style("dash", "spaces")
        yield

    def test_all_tabs_keyboard_shortcut(self, set_default_format_style):
        kbd = self.all_keyboard_shortcuts.get_by_manifest_key("all-tabs-link-as-list")
        expected_format = self.EXPECTED_TABS_LIST
        expected_text = expected_format.format(
            url=self.fixture_server.url,
        )
        self.browser.switch_to_demo_window()
        Clipboard.clear()
        kbd.press()
        clipboard_text = self.browser.window.poll_clipboard_content()
        assert clipboard_text == expected_text

    def test_all_tabs_popup_menu(self, set_default_format_style):
        expected_format = self.EXPECTED_TABS_LIST
        expected_text = expected_format.format(
            url=self.fixture_server.url,
        )
        self.browser.switch_to_demo_window()
        Clipboard.clear()
        self.browser.trigger_popup_menu("all-tabs-link-as-list")
        clipboard_text = self.browser.window.poll_clipboard_content()
        assert clipboard_text == expected_text
