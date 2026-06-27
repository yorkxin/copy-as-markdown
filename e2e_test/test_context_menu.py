import pytest
from typing import Optional
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from e2e_test.conftest import BrowserEnvironment, FixtureServer
from e2e_test.helpers import Clipboard


class TestContextMenu:
    browser: Optional[BrowserEnvironment] = None
    fixture_server: Optional[FixtureServer] = None

    @pytest.fixture(scope="class", autouse=True)
    @classmethod
    def setup_browser(cls, request, browser_environment: BrowserEnvironment, fixture_server: FixtureServer):
        cls.browser = browser_environment
        cls.fixture_server = fixture_server
        yield

    def test_context_menu_copy_link(self):
        Clipboard.clear()
        self.browser.driver.switch_to.new_window('tab')
        tab = self.browser.driver.current_window_handle
        try:
            self.browser.driver.get(self.fixture_server.url + "/qa.html")
            # link-1 is a clean text-only anchor whose href is the absolute
            # "about:blank", so the expected markdown is server-independent.
            # (The first <a> in qa.html wraps an <img>, which muddies the link
            # context, so target link-1 explicitly.)
            link = WebDriverWait(self.browser.driver, 10).until(
                EC.element_to_be_clickable((By.ID, "link-1"))
            )
            self.browser.context_menu_click(link, "Copy Link as Markdown")
            clipboard_text = Clipboard.poll()
            assert clipboard_text == "[[APOLLO-13] Build A Rocket Engine](about:blank)"
        finally:
            self.browser.driver.switch_to.window(tab)
            self.browser.driver.close()
