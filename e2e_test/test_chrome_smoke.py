import os
import pytest
from typing import Optional
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from e2e_test.conftest import ChromeBrowserEnvironment, FixtureServer
from e2e_test.helpers import Clipboard

# Real-input Chrome smoke tests: drive the extension through actual keystrokes
# (xdotool) and native right-click context menus (AT-SPI), then read the real
# system clipboard -- the very paths the Playwright suite can only *simulate*
# via chrome.commands / chrome.contextMenus .dispatch(). Like the Firefox AT-SPI
# tests, these need the Docker entrypoint's D-Bus session + accessibility bus
# (and Chromium, which only the Docker image ships), so skip otherwise.
pytestmark = pytest.mark.skipif(
    os.environ.get("GNOME_ACCESSIBILITY") != "1"
    or not os.environ.get("DBUS_SESSION_BUS_ADDRESS"),
    reason="Chrome smoke tests require dbus-run-session + GNOME_ACCESSIBILITY=1 (Docker entrypoint)",
)


class TestChromeSmoke:
    browser: Optional[ChromeBrowserEnvironment] = None
    fixture_server: Optional[FixtureServer] = None

    @pytest.fixture(scope="class", autouse=True)
    @classmethod
    def setup_browser(cls, request, chrome_browser_environment: ChromeBrowserEnvironment, fixture_server: FixtureServer):
        cls.browser = chrome_browser_environment
        cls.fixture_server = fixture_server
        yield

    def test_keyboard_current_tab_link(self):
        # Real keyboard shortcut: Alt+Shift+2 is bound to current-tab-link via the
        # manifest suggested_key injected by build-test-extension.js. This is the
        # binding path Playwright cannot exercise (it dispatches onCommand directly).
        Clipboard.clear()
        self.browser.driver.get(self.fixture_server.url + "/qa.html")
        WebDriverWait(self.browser.driver, 10).until(
            EC.presence_of_element_located((By.ID, "link-1"))
        )
        self.browser.press_shortcut("2")
        clipboard_text = Clipboard.poll()
        expected = f"[[QA] \\*\\*Hello\\*\\* \\_World\\_]({self.fixture_server.url}/qa.html)"
        assert clipboard_text == expected

    def test_context_menu_copy_link(self):
        Clipboard.clear()
        self.browser.driver.get(self.fixture_server.url + "/qa.html")
        link = WebDriverWait(self.browser.driver, 10).until(
            EC.element_to_be_clickable((By.ID, "link-1"))
        )
        self.browser.context_menu_click(link, "Copy Link as Markdown")
        clipboard_text = Clipboard.poll()
        # REAL Chrome behaviour, pinned deliberately: Chrome's contextMenus
        # OnClickData has no `linkText` (a Firefox-only field), and a bare
        # right-click does not populate `selectionText` on Linux, so the link
        # title falls back to "(No Title)" (context-menu-handler.ts -> markdown.ts).
        # The Playwright suite masks this by injecting selectionText from the DOM;
        # this test records what a user actually gets on Chrome. If the extension
        # is fixed to read the link text, update this expectation.
        assert clipboard_text == "[(No Title)](about:blank)"

    def test_context_menu_copy_image(self):
        Clipboard.clear()
        self.browser.driver.get(self.fixture_server.url + "/qa.html")
        img = WebDriverWait(self.browser.driver, 10).until(
            EC.presence_of_element_located((By.ID, "img-1"))
        )
        self.browser.context_menu_click(img, "Copy Image as Markdown")
        clipboard_text = Clipboard.poll()
        # Image markdown comes from info.srcUrl; alt text is not exposed by the
        # contextMenus API (same empty-alt result as the Firefox suite).
        assert clipboard_text == f"![]({self.fixture_server.url}/icon.png)"
