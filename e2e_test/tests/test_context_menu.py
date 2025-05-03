import time
import pyautogui
import pytesseract
import pyperclip
from PIL import ImageGrab
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.common.by import By

from e2e_test.helpers import GUI, OCR, Clipboard

MENU_ITEM_TEXT = "Copy as Markdown"       # The text on your context menu
SUBMENU_ITEM_TEXT = "Copy Link as Markdown"  # The text on the submenu

pyautogui.FAILSAFE = False  # Optional: disables moving mouse to screen corner to abort

class TestContextMenu:
    def test_extension_context_menu(self, browser_environment, fixture_server):
        driver = browser_environment.driver
        win_pos = driver.get_window_position()
        win_size = driver.get_window_size()
        print(f"Window position: {win_pos}, size: {win_size}")

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

        # Take screenshot of the full window
        bbox = OCR.get_window_bbox(win_pos, win_size)
        print(f"Bounding box: {bbox}")
        screen = ImageGrab.grab(bbox=bbox)
        OCR.save_debug_image(screen, "context_menu_debug.png")

        # OCR to find the menu item
        text_data = pytesseract.image_to_data(screen, output_type=pytesseract.Output.DICT)
        print(f"Text data: {text_data}")

        # Find the menu item
        found, coords = OCR.find_phrase_in_ocr(text_data, MENU_ITEM_TEXT)
        assert found, f"Context menu item '{MENU_ITEM_TEXT}' not found by OCR."
        
        # Add visual debugging
        OCR.save_debug_image(screen, "context_menu_debug_marker.png", coords)
        
        # Move to and click the menu item
        screen_x = win_pos['x'] + coords['x']
        screen_y = win_pos['y'] + coords['y']
        GUI.move_and_click(screen_x, screen_y)

        # Wait for submenu to appear
        time.sleep(1)

        # Take screenshot of the submenu area
        submenu_bbox = OCR.get_submenu_bbox(win_pos, win_size, coords)
        print(f"Submenu bounding box: {submenu_bbox}")
        screen = ImageGrab.grab(bbox=submenu_bbox)
        screen = OCR.enhance_image_contrast(screen)
        OCR.save_debug_image(screen, "submenu_debug.png")

        # OCR to find the submenu item
        text_data = pytesseract.image_to_data(screen, output_type=pytesseract.Output.DICT)
        print(f"Submenu text data: {text_data}")

        # Find the submenu item
        found, submenu_coords = OCR.find_phrase_in_ocr(text_data, SUBMENU_ITEM_TEXT)
        assert found, f"Submenu item '{SUBMENU_ITEM_TEXT}' not found by OCR."
        
        # Add visual debugging for submenu
        OCR.save_debug_image(screen, "submenu_debug_marker.png", submenu_coords)
        
        # Move to and click the submenu item
        screen_x = submenu_bbox[0] + submenu_coords['x']
        screen_y = submenu_bbox[1] + submenu_coords['y']
        GUI.move_and_click(screen_x, screen_y)

        # Wait for clipboard to update
        time.sleep(1)

        # Read and verify clipboard content
        clipboard_content = Clipboard.read()
        print(f"Clipboard content: {clipboard_content}")
        assert clipboard_content == '[[APOLLO-13] Build A Rocket Engine](about:blank)'