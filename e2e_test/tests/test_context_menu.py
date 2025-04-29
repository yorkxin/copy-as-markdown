import time
import pyautogui
import pytesseract
import pyperclip
from PIL import ImageGrab, ImageDraw, Image
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.chrome.webdriver import WebDriver as ChromeDriver
from selenium.webdriver.firefox.webdriver import WebDriver as FirefoxDriver
from selenium.webdriver.common.by import By
from typing import Tuple, List, Dict, Optional

def find_phrase_in_ocr(text_data: Dict, target_phrase: str) -> Tuple[bool, Optional[Dict]]:
    """
    Find a phrase in OCR text data and return its coordinates.
    
    Args:
        text_data: OCR text data from pytesseract
        target_phrase: The phrase to search for
        
    Returns:
        Tuple of (found, coordinates) where coordinates is None if not found
    """
    # Combine consecutive words and their coordinates
    combined_text = []
    combined_coords = []
    current_text = []
    current_coords = []
    
    for i, word in enumerate(text_data['text']):
        if word.strip():  # Only process non-empty words
            current_text.append(word)
            current_coords.append({
                'left': text_data['left'][i],
                'top': text_data['top'][i],
                'width': text_data['width'][i],
                'height': text_data['height'][i]
            })
        else:
            if current_text:
                combined_text.append(' '.join(current_text))
                # Calculate combined coordinates
                left = min(c['left'] for c in current_coords)
                top = min(c['top'] for c in current_coords)
                right = max(c['left'] + c['width'] for c in current_coords)
                bottom = max(c['top'] + c['height'] for c in current_coords)
                combined_coords.append({
                    'left': left,
                    'top': top,
                    'width': right - left,
                    'height': bottom - top
                })
                current_text = []
                current_coords = []
    
    # Process any remaining words
    if current_text:
        combined_text.append(' '.join(current_text))
        left = min(c['left'] for c in current_coords)
        top = min(c['top'] for c in current_coords)
        right = max(c['left'] + c['width'] for c in current_coords)
        bottom = max(c['top'] + c['height'] for c in current_coords)
        combined_coords.append({
            'left': left,
            'top': top,
            'width': right - left,
            'height': bottom - top
        })

    # Search for the phrase
    for i, text in enumerate(combined_text):
        if target_phrase.lower() in text.lower():
            coords = {
                'x': combined_coords[i]['left'] + combined_coords[i]['width'] // 2,
                'y': combined_coords[i]['top'] + combined_coords[i]['height'] // 2,
                'left': combined_coords[i]['left'],
                'top': combined_coords[i]['top'],
                'width': combined_coords[i]['width'],
                'height': combined_coords[i]['height']
            }
            return True, coords
    
    return False, None

MENU_ITEM_TEXT = "Copy as Markdown"       # The text on your context menu
SUBMENU_ITEM_TEXT = "Copy Link as Markdown"  # The text on the submenu

pyautogui.FAILSAFE = False  # Optional: disables moving mouse to screen corner to abort


def clear_clipboard():
    pyperclip.copy('')  # Clear clipboard


def read_clipboard():
    return pyperclip.paste()


def test_extension_context_menu(driver: WebDriver, fixture_server):
    win_pos = driver.get_window_position()
    win_size = driver.get_window_size()
    print(f"Window position: {win_pos}, size: {win_size}")

    driver.get(fixture_server.url+"/qa.html")

    time.sleep(2)  # wait for page to load

    # Clear clipboard before testing
    clear_clipboard()
    assert read_clipboard() == '', "Clipboard was not empty at start of test."

    # Right-click the first link
    link = driver.find_element(By.ID, "link-1")
    actions = ActionChains(driver)
    actions.context_click(link).perform()

    time.sleep(1)  # wait for context menu to show

    # Screenshot the full screen
    bbox = (win_pos['x'], win_pos['y'], win_pos['x'] + win_size['width'], win_pos['y'] + win_size['height'])
    print(f"Bounding box: {bbox}")
    screen = ImageGrab.grab(bbox=bbox)
    screen.save("context_menu_debug.png")

    # OCR to find the menu item
    text_data = pytesseract.image_to_data(screen, output_type=pytesseract.Output.DICT)
    print(f"Text data: {text_data}")

    # Find the menu item
    found, coords = find_phrase_in_ocr(text_data, MENU_ITEM_TEXT)
    assert found, f"Context menu item '{MENU_ITEM_TEXT}' not found by OCR."
    
    # Add visual debugging
    debug_img = screen.copy()
    draw = ImageDraw.Draw(debug_img)
    draw.ellipse([coords['x']-5, coords['y']-5, coords['x']+5, coords['y']+5], fill='red')
    debug_img.save("context_menu_debug_with_marker.png")
    
    # Move to and click the menu item
    screen_x = win_pos['x'] + coords['x']
    screen_y = win_pos['y'] + coords['y']
    print(f"Moving mouse to screen coordinates: x={screen_x}, y={screen_y}")
    pyautogui.moveTo(screen_x, screen_y, duration=0.2)

    # Wait for submenu to appear
    time.sleep(1)

    # Take a screenshot of only the right side of the window (where the submenu should be)
    right_bbox = (
        win_pos['x'] + coords['left'] + coords['width'],  # Start from right edge of parent menu
        win_pos['y'],                                     # Top of window
        win_pos['x'] + win_size['width'],                 # Right edge of window
        win_pos['y'] + win_size['height']                 # Bottom of window
    )
    print(f"Right side bounding box: {right_bbox}")
    screen = ImageGrab.grab(bbox=right_bbox)
    
    # Convert to grayscale and enhance contrast
    screen = screen.convert('L')  # Convert to grayscale
    # Enhance contrast using point operation
    screen = screen.point(lambda x: 0 if x < 128 else 255, '1')  # Convert to binary image
    
    screen.save("submenu_debug.png")

    # OCR to find the submenu item
    text_data = pytesseract.image_to_data(screen, output_type=pytesseract.Output.DICT)
    print(f"Submenu text data: {text_data}")

    # Find the submenu item
    found, submenu_coords = find_phrase_in_ocr(text_data, SUBMENU_ITEM_TEXT)
    assert found, f"Submenu item '{SUBMENU_ITEM_TEXT}' not found by OCR."
    
    # Add visual debugging for submenu
    debug_img = screen.copy()
    draw = ImageDraw.Draw(debug_img)
    draw.ellipse([submenu_coords['x']-5, submenu_coords['y']-5, 
                 submenu_coords['x']+5, submenu_coords['y']+5], fill='red')
    debug_img.save("submenu_debug_with_marker.png")
    
    # Move to and click the submenu item
    # Add the right_bbox origin to the coordinates
    screen_x = right_bbox[0] + submenu_coords['x']
    screen_y = right_bbox[1] + submenu_coords['y']
    print(f"Moving mouse to submenu item at screen coordinates: x={screen_x}, y={screen_y}")
    pyautogui.moveTo(screen_x, screen_y, duration=0.2)
    pyautogui.click()

    # Wait for clipboard to update
    time.sleep(1)

    # Read and verify clipboard content
    clipboard_content = read_clipboard()
    print(f"Clipboard content: {clipboard_content}")
    assert clipboard_content == '[[APOLLO-13] Build A Rocket Engine](about:blank)'