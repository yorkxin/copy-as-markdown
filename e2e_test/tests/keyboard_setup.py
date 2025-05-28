"""
Shared helper functions for setting up keyboard shortcuts in browser tests.
"""
import time
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from pyshadow.main import Shadow


def setup_keyboard_shortcuts(driver, keyboard_shortcuts):
    """
    Configure keyboard shortcuts for the extension in Chrome's extension shortcuts page.
    
    Args:
        driver: Selenium WebDriver instance
        keyboard_shortcuts: KeyboardShortcuts object containing shortcuts to configure
    
    Returns:
        str: The original window handle before navigation
    """
    print("Setting up keyboard tests...")
    
    # Store the original window handle
    original_window = driver.current_window_handle
    
    driver.get("chrome://extensions/shortcuts")
    shadow = Shadow(driver)

    for shortcut in keyboard_shortcuts.items:
        element = shadow.find_element(f"[aria-label=\"Edit shortcut {shortcut.label} for Copy as Markdown\"]")
        driver.execute_script("arguments[0].scrollIntoView(true);", element)
        element.click()
        key = shortcut.keystroke
        actions = ActionChains(driver)
        actions.key_down(Keys.ALT).key_down(Keys.SHIFT).send_keys(key).key_up(Keys.SHIFT).key_up(Keys.ALT).perform()
    
    return original_window
