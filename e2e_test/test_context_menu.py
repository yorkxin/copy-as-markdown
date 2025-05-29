import os
import time
import pyautogui
import pytest
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By

from e2e_test.conftest import BrowserEnvironment, FixtureServer
from e2e_test.helpers import Clipboard

MAIN_MENU_ITEM_TEXT = "Copy as Markdown"
MENU_ITEM_COPY_LINK_AS_MARKDOWN = "Copy Link as Markdown"
MENU_ITEM_COPY_PAGE_LINK_AS_MARKDOWN = "Copy Page Link as Markdown"
MENU_ITEM_COPY_IMAGE_AS_MARKDOWN = "Copy Image as Markdown"
COPY_SELECTION_AS_MARKDOWN = "Copy Selection as Markdown"

pyautogui.FAILSAFE = False  # Optional: disables moving mouse to screen corner to abort

class TestContextMenu:
    @pytest.fixture(scope="class", autouse=True)
    def _load_page(self, browser_environment: BrowserEnvironment, fixture_server):
        browser_environment.driver.get(fixture_server.url+"/qa.html")
    
    @pytest.fixture(scope="function", autouse=True)
    def _reset(self, browser_environment: BrowserEnvironment):
        # dismiss any context menu that may be open
        browser_environment.window.click_center()
        Clipboard.clear()
        assert Clipboard.read() == '', "Clipboard was not empty at start of test."

    def test_copy_link_as_markdown(self, browser_environment: BrowserEnvironment, fixture_server: FixtureServer):
        driver = browser_environment.driver
        win = browser_environment.window
        # Right-click the first link
        link = driver.find_element(By.ID, "link-1")
        actions = ActionChains(driver)
        actions.context_click(link).perform()
        time.sleep(1)  # wait for context menu to show

        # Find the menu item
        found = win.find_and_click_menu_item(MENU_ITEM_COPY_LINK_AS_MARKDOWN)
        assert found, f"Context menu item '{MENU_ITEM_COPY_LINK_AS_MARKDOWN}' not found by OCR."

        # Read and verify clipboard content
        clipboard_content = win.poll_clipboard_content()
        assert clipboard_content == '[[APOLLO-13] Build A Rocket Engine](about:blank)'

    def test_copy_page_link_as_markdown(self, browser_environment: BrowserEnvironment, fixture_server: FixtureServer):
        driver = browser_environment.driver
        win = browser_environment.window
        # Right-click the page
        actions = ActionChains(driver)
        actions.context_click(driver.find_element(By.TAG_NAME, "body")).perform()
        time.sleep(1)  # wait for context menu to show

        found = win.find_and_click_menu_item(MENU_ITEM_COPY_PAGE_LINK_AS_MARKDOWN)
        assert found, f"Submenu item '{MENU_ITEM_COPY_PAGE_LINK_AS_MARKDOWN}' not found by OCR."

        clipboard_content = win.poll_clipboard_content()
        assert clipboard_content == f"[[QA] \*\*Hello\*\* \_World\_]({fixture_server.url}/qa.html)"

    def test_copy_page_link_as_markdown_with_image(self, browser_environment: BrowserEnvironment, fixture_server: FixtureServer):
        driver = browser_environment.driver
        win = browser_environment.window
        # Right-click the image
        image = driver.find_element(By.ID, "img-1")
        actions = ActionChains(driver)
        actions.context_click(image).perform()
        time.sleep(1)  # wait for context menu to show

        found = win.find_and_click_menu_item(MENU_ITEM_COPY_IMAGE_AS_MARKDOWN)
        assert found, f"Submenu item '{MENU_ITEM_COPY_IMAGE_AS_MARKDOWN}' not found by OCR."

        clipboard_content = win.poll_clipboard_content()
        assert clipboard_content == f'![]({fixture_server.url}/icon.png)'

    def test_copy_image_as_markdown_within_link(self, browser_environment: BrowserEnvironment, fixture_server: FixtureServer):
        driver = browser_environment.driver
        win = browser_environment.window
        # Right-click the image
        image = driver.find_element(By.ID, "link-9")
        actions = ActionChains(driver)
        actions.context_click(image).perform()
        time.sleep(1)  # wait for context menu to show

        found = win.find_and_click_menu_item(MENU_ITEM_COPY_LINK_AS_MARKDOWN)
        assert found, f"Submenu item '{MENU_ITEM_COPY_LINK_AS_MARKDOWN}' not found by OCR."

        clipboard_content = win.poll_clipboard_content()
        assert clipboard_content == f'[![]({fixture_server.url}/icon.png)]({fixture_server.url}/1.html)'

    def test_copy_selection_as_markdown(self, browser_environment: BrowserEnvironment, fixture_server: FixtureServer):
        driver = browser_environment.driver
        win = browser_environment.window
        
        driver.get(fixture_server.url+"/selection.html")
        time.sleep(1)  # wait for page to load

        # Select all text
        browser_environment.select_all()

        # Right-click the page
        actions = ActionChains(driver)
        actions.context_click(driver.find_element(By.TAG_NAME, "body")).perform()
        time.sleep(1)  # wait for context menu to show

        found = win.find_and_click_menu_item(COPY_SELECTION_AS_MARKDOWN)
        assert found, f"Submenu item '{COPY_SELECTION_AS_MARKDOWN}' not found by OCR."

        expected_content = open(os.path.join(os.path.dirname(__file__), "..", "fixtures", "selection.md")).read()
        expected_content = expected_content.replace("http://localhost:5566", fixture_server.url)

        clipboard_content = win.poll_clipboard_content()
        assert clipboard_content == expected_content
    