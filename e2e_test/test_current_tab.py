import os
import pytest
from typing import Optional

from e2e_test.conftest import FirefoxBrowserEnvironment, FixtureServer
from e2e_test.helpers import Clipboard
from e2e_test.keyboard_shortcuts import init_keyboard_shortcuts

# Custom-format copy is functional behaviour, not an OS-input → clipboard smoke
# path. It is already covered by the Playwright/vitest UI suites
# (test/e2e/ui/custom-format.spec.ts). Exercising it here also requires driving
# the custom-format editor's save UI as setup, whose async write has no
# completion signal and flakes under Selenium — cost without smoke value.
SKIP_CUSTOM_FORMAT = "custom-format copy is functional, not smoke; covered by the Playwright/vitest UI suites"


class TestCurrentTab:
    browser: Optional[FirefoxBrowserEnvironment] = None
    fixture_server: Optional[FixtureServer] = None
    all_keyboard_shortcuts = init_keyboard_shortcuts([
        "selection-as-markdown",
        "current-tab-link",
        "current-tab-custom-format-1",
    ])

    @pytest.fixture(scope="class", autouse=True)
    @classmethod
    def setup_browser(cls, request, browser_environment: FirefoxBrowserEnvironment, fixture_server: FixtureServer):
        cls.browser = browser_environment
        cls.fixture_server = fixture_server

        cls.browser.open_test_helper_window(cls.fixture_server.url)
        cls.browser.open_demo_window()

        yield

        if cls.browser._demo_window_handle:
            cls.browser.close_demo_window()

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

    @pytest.mark.skip(reason=SKIP_CUSTOM_FORMAT)
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

    @pytest.mark.skip(reason=SKIP_CUSTOM_FORMAT)
    def test_popup_current_tab_custom_format(self):
        expected_text = f"Page 0 - Copy as Markdown,{self.fixture_server.url}/0.html"
        self.browser.open_popup()
        self.browser.trigger_popup_menu("current-tab-custom-format-1")
        clipboard_text = Clipboard.poll()
        assert clipboard_text == expected_text
