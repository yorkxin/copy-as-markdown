import os
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
    def setup_browser(cls, request, accessible_browser_environment: BrowserEnvironment, fixture_server: FixtureServer):
        cls.browser = accessible_browser_environment
        cls.fixture_server = fixture_server
        yield

    def test_context_menu_copy_link(self):
        Clipboard.clear()
        original = self.browser.driver.current_window_handle
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
            self.browser.driver.switch_to.window(original)

    def test_context_menu_copy_image(self):
        Clipboard.clear()
        original = self.browser.driver.current_window_handle
        self.browser.driver.switch_to.new_window('tab')
        tab = self.browser.driver.current_window_handle
        try:
            self.browser.driver.get(self.fixture_server.url + "/qa.html")
            # img-1 is a standalone <img> (not wrapped in <a>) so the context
            # is purely "image", producing a flat single-item menu.
            img = WebDriverWait(self.browser.driver, 10).until(
                EC.presence_of_element_located((By.ID, "img-1"))
            )
            self.browser.context_menu_click(img, "Copy Image as Markdown")
            clipboard_text = Clipboard.poll()
            # Firefox's contextMenus API does not expose the img's alt attribute;
            # the extension receives an empty string for the alt, so the output
            # has no alt text even though the element has alt="ICON".
            assert clipboard_text == f"![]({self.fixture_server.url}/icon.png)"
        finally:
            self.browser.driver.switch_to.window(tab)
            self.browser.driver.close()
            self.browser.driver.switch_to.window(original)

    def test_context_menu_copy_selection(self):
        Clipboard.clear()
        original = self.browser.driver.current_window_handle
        self.browser.driver.switch_to.new_window('tab')
        tab = self.browser.driver.current_window_handle
        try:
            self.browser.driver.get(self.fixture_server.url + "/selection.html")
            self.browser.select_all()
            body = self.browser.driver.find_element(By.TAG_NAME, "body")
            self.browser.context_menu_click(body, "Copy Selection as Markdown")
            clipboard_text = Clipboard.poll()
            selection_md = os.path.join(os.path.dirname(__file__), "..", "fixtures", "selection.md")
            with open(selection_md) as f:
                expected_content = f.read().replace("http://localhost:5566", self.fixture_server.url)
            assert clipboard_text == expected_content
        finally:
            self.browser.driver.switch_to.window(tab)
            self.browser.driver.close()
            self.browser.driver.switch_to.window(original)

    @pytest.mark.skip(reason="bookmark menu requires AT-SPI-driven bookmark UI; not yet validated (see plan Task 4)")
    def test_context_menu_copy_bookmark(self):
        ...  # intentionally unimplemented; tracks the coverage gap
