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

MENU_ITEM_TEXT = "Copy as Markdown"       # The text on your context menu
SUBMENU_ITEM_TEXT = "Copy Link as Markdown"  # The text on the submenu

pyautogui.FAILSAFE = False  # Optional: disables moving mouse to screen corner to abort

class TestContextMenu:
    def test_extension_context_menu(self, browser_environment: BrowserEnvironment, fixture_server):
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
        found, coords_bbox = win.find_phrase_with_ocr(MENU_ITEM_TEXT)
        assert found, f"Context menu item '{MENU_ITEM_TEXT}' not found by OCR."

        # Move to the parent menu item
        win.move_to(coords_bbox.center())

        # Wait for submenu to appear
        time.sleep(1)

        # Find the submenu item
        found, submenu_coords_bbox = win.find_phrase_with_ocr(SUBMENU_ITEM_TEXT)
        assert found, f"Submenu item '{SUBMENU_ITEM_TEXT}' not found by OCR."

        # Move to and click the submenu item
        win.click(submenu_coords_bbox.center())

        # Wait for clipboard to update
        time.sleep(1)

        # Read and verify clipboard content
        clipboard_content = Clipboard.read()
        print(f"Clipboard content: {clipboard_content}")
        assert clipboard_content == '[[APOLLO-13] Build A Rocket Engine](about:blank)'