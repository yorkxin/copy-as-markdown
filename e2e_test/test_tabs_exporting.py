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
        clipboard_text = Clipboard.poll()
        assert clipboard_text == expected_text

    def test_all_tabs_popup_menu(self, set_default_format_style):
        expected_format = self.EXPECTED_TABS_LIST
        expected_text = expected_format.format(
            url=self.fixture_server.url,
        )
        self.browser.switch_to_demo_window()
        Clipboard.clear()
        self.browser.trigger_popup_menu("all-tabs-link-as-list")
        clipboard_text = Clipboard.poll()
        assert clipboard_text == expected_text

    def test_all_tabs_popup_custom_format(self, set_default_format_style):
        expected_text = dedent("""
            1,'Page 0 - Copy as Markdown','{url}/0.html'
            2,'Page 1 - Copy as Markdown','{url}/1.html'
            3,'Page 2 - Copy as Markdown','{url}/2.html'
            4,'Page 3 - Copy as Markdown','{url}/3.html'
            5,'Page 4 - Copy as Markdown','{url}/4.html'
            6,'Page 5 - Copy as Markdown','{url}/5.html'
            7,'Page 6 - Copy as Markdown','{url}/6.html'
            8,'Page 7 - Copy as Markdown','{url}/7.html'
        """).lstrip().format(url=self.fixture_server.url)
        self.browser.switch_to_demo_window()
        Clipboard.clear()
        self.browser.trigger_popup_menu("all-tabs-custom-format-1")
        clipboard_text = Clipboard.poll()
        assert clipboard_text == expected_text

    def test_all_tabs_grouped_popup_custom_format(self, set_default_format_style):
        expected_text = dedent("""
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
        """).lstrip().format(url=self.fixture_server.url)
        self.browser.set_grouped_tabs()
        self.browser.switch_to_demo_window()
        Clipboard.clear()
        self.browser.trigger_popup_menu("all-tabs-custom-format-2")
        clipboard_text = Clipboard.poll()
        assert clipboard_text == expected_text
