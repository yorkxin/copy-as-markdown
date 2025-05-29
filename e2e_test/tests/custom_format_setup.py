import time
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from textwrap import dedent
from typing import Optional, Tuple

from e2e_test.helpers import Clipboard
from e2e_test.conftest import BrowserEnvironment

def run_test_popup_menu_action(browser_environment: BrowserEnvironment, button_id: str, expected_text: str) -> None:
    """Test a popup menu action and verify the clipboard content.
    
    Args:
        driver: The WebDriver instance
        extension_base_url: The base URL of the extension
        button_id: The ID of the button to click
        expected_text: The expected text in the clipboard after clicking
    """
    Clipboard.clear()
    browser_environment.switch_to_popup()
    copy_button = browser_environment.driver.find_element(By.ID, button_id)
    copy_button.click()
    clipboard_text = browser_environment.window.poll_clipboard_content()
    assert clipboard_text == expected_text
