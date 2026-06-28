import os
import pytest
from typing import Optional
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from e2e_test.conftest import FirefoxBrowserEnvironment, FixtureServer
from e2e_test.helpers import Clipboard

# These tests drive Firefox's native GTK context menu through the AT-SPI
# accessibility bus, which only exists when the suite runs via the Docker
# entrypoint (run-selenium.sh wraps pytest in `dbus-run-session` and exports
# GNOME_ACCESSIBILITY=1). Running them on the bare `npm run test:e2e:selenium`
# path (no bus) would just time out, so skip the module unless both signals are
# present. In Docker both are set, so the tests run normally.
pytestmark = pytest.mark.skipif(
    os.environ.get("GNOME_ACCESSIBILITY") != "1"
    or not os.environ.get("DBUS_SESSION_BUS_ADDRESS"),
    reason="AT-SPI context-menu tests require dbus-run-session + GNOME_ACCESSIBILITY=1 (Docker entrypoint)",
)


class TestContextMenu:
    # Each test targets a single-item context (one extension menu item per
    # right-click target) so the native menu stays flat. See atspi_menu.py for
    # why submenu nesting would require additional traversal logic.
    browser: Optional[FirefoxBrowserEnvironment] = None
    fixture_server: Optional[FixtureServer] = None

    @pytest.fixture(scope="class", autouse=True)
    @classmethod
    def setup_browser(cls, request, accessible_browser_environment: FirefoxBrowserEnvironment, fixture_server: FixtureServer):
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

    @pytest.mark.skip(reason="bookmark context menu lives in Firefox chrome (not the DOM); no validated headless trigger yet")
    def test_context_menu_copy_bookmark(self):
        # Unlike the link/image/selection items above, the "Copy Bookmark or
        # Folder as Markdown" item is registered with contexts: ['bookmark'], so
        # it only appears when right-clicking a node in Firefox's own bookmark UI
        # (Bookmarks Toolbar / sidebar / Library) -- browser chrome, not web
        # content. That makes it hard to drive in this harness:
        #
        #   1. Selenium/WebDriver can only reach the DOM, so the
        #      `context_menu_click` recipe (ActionChains.context_click on a page
        #      element) has no element to target -- there is no DOM node here.
        #   2. The interaction would have to go entirely through AT-SPI/xdotool:
        #      seed a bookmark (fixtures only serve web pages, not bookmark
        #      state), open the bookmark UI, and locate the node in the a11y tree.
        #   3. Opening a *context* menu on that node is the sharp edge: AT-SPI's
        #      do_action(node, 0) performs the primary (activate) action, not a
        #      right-click, and there is no portable AT-SPI "open context menu"
        #      action. Falling back to an xdotool right-click at the node's screen
        #      coordinates reintroduces the coordinate/pixel brittleness the
        #      AT-SPI approach was chosen to avoid.
        #
        # Left as a tracked skip (visible in the run with a reason) rather than a
        # flaky, unvalidated test. Covering it warrants its own spike to confirm a
        # reliable headless seed -> open -> right-click path for a bookmark node.
        ...
