import time
import pyautogui
import pytesseract
import pyperclip
from PIL import ImageGrab
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.common.by import By

from e2e_test.conftest import BrowserEnvironment
from e2e_test.helpers import Clipboard, Window

MAIN_MENU_ITEM_TEXT = "Copy as Markdown"
MENU_ITEM_COPY_LINK_AS_MARKDOWN = "Copy Link as Markdown"
MENU_ITEM_COPY_PAGE_LINK_AS_MARKDOWN = "Copy Page Link as Markdown"

pyautogui.FAILSAFE = False  # Optional: disables moving mouse to screen corner to abort

class TestContextMenu:
    def test_copy_link_as_markdown(self, browser_environment: BrowserEnvironment, fixture_server):
        driver = browser_environment.driver
        win = browser_environment.window

        driver.get(fixture_server.url+"/qa.html")
        time.sleep(1)  # wait for page to load

        # Clear clipboard before testing
        Clipboard.clear()
        assert Clipboard.read() == '', "Clipboard was not empty at start of test."

        # Right-click the first link
        link = driver.find_element(By.ID, "link-1")
        actions = ActionChains(driver)
        actions.context_click(link).perform()
        time.sleep(1)  # wait for context menu to show

        # Find the menu item
        found = win.find_and_click_menu_item(MENU_ITEM_COPY_LINK_AS_MARKDOWN)
        assert found, f"Context menu item '{MENU_ITEM_COPY_LINK_AS_MARKDOWN}' not found by OCR."

        # Wait for clipboard to update
        time.sleep(1)

        # Read and verify clipboard content
        clipboard_content = Clipboard.read()
        assert clipboard_content == '[[APOLLO-13] Build A Rocket Engine](about:blank)'

    def test_copy_page_link_as_markdown(self, browser_environment: BrowserEnvironment, fixture_server):
        driver = browser_environment.driver
        win = browser_environment.window

        driver.get(fixture_server.url+"/qa.html")
        time.sleep(1)  # wait for page to load

        # Clear clipboard before testing
        Clipboard.clear()
        assert Clipboard.read() == '', "Clipboard was not empty at start of test."

        # Right-click the page
        actions = ActionChains(driver)
        actions.context_click(driver.find_element(By.TAG_NAME, "body")).perform()
        time.sleep(1)  # wait for context menu to show

        found = win.find_and_click_menu_item(MENU_ITEM_COPY_PAGE_LINK_AS_MARKDOWN)
        assert found, f"Submenu item '{MENU_ITEM_COPY_PAGE_LINK_AS_MARKDOWN}' not found by OCR."

        # Wait for clipboard to update
        time.sleep(1)

        # Read and verify clipboard content
        clipboard_content = Clipboard.read()
        assert clipboard_content == f"[[QA] \*\*Hello\*\* \_World\_]({fixture_server.url}/qa.html)"
