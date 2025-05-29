import time
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from textwrap import dedent
from typing import Optional, Tuple

from e2e_test.helpers import Clipboard
from e2e_test.conftest import BrowserEnvironment

def setup_custom_format(driver: WebDriver, extension_base_url: str, context: str, template: str, slot: int, show_in_popup: bool = True):
    """Setup custom format for the specified context in the specified slot."""
    driver.switch_to.new_window('window')
    driver.get(f"{extension_base_url}/dist/ui/custom-format.html?context={context}&slot={slot}")
    textarea = driver.find_element(By.ID, "input-template")
    textarea.clear()
    textarea.send_keys(template)
    if show_in_popup:
        show_in_popup_checkbox = driver.find_element(By.ID, "input-show-in-menus")
        show_in_popup_checkbox.click()
    save_button = driver.find_element(By.ID, "save")
    save_button.click()
    driver.close()

def setup_multiple_links_custom_format(driver: WebDriver, extension_base_url: str, template: str, slot: int, show_in_popup: bool = True):
    """Setup custom format for multiple links in the specified slot."""
    setup_custom_format(driver, extension_base_url, "multiple-links", template, slot, show_in_popup)

def setup_single_link_custom_format(driver: WebDriver, extension_base_url: str, template: str, slot: int, show_in_popup: bool = True):
    """Setup custom format for single link in the specified slot."""
    setup_custom_format(driver, extension_base_url, "single-link", template, slot, show_in_popup)

def setup_all_custom_formats(driver: WebDriver, extension_base_url: str):
    """Setup all custom formats used in tests."""
    original_window = driver.current_window_handle
    
    # Setup single link custom format (slot 1)
    setup_single_link_custom_format(driver, extension_base_url, "{{title}},{{url}}", slot=1)
    driver.switch_to.window(original_window)
    
    # Setup multiple links custom format (slot 1)
    setup_multiple_links_custom_format(driver, extension_base_url, dedent("""
        {{#links}}
        {{number}},'{{title}}','{{url}}'
        {{/links}}
        """).strip(), slot=1)
    driver.switch_to.window(original_window)

    # Setup multiple links custom format with groups (slot 2)
    setup_multiple_links_custom_format(driver, extension_base_url, dedent("""
        {{#grouped}}
        {{number}},title='{{title}}',url='{{url}}',isGroup={{isGroup}}
        {{#links}}
            {{number}},title='{{title}}',url='{{url}}'
        {{/links}}
        {{/grouped}}
        """).strip(), slot=2)
    driver.switch_to.window(original_window)

def run_test_popup_menu_action(browser_environment: BrowserEnvironment, button_id: str, expected_text: str) -> None:
    """Test a popup menu action and verify the clipboard content.
    
    Args:
        driver: The WebDriver instance
        extension_base_url: The base URL of the extension
        button_id: The ID of the button to click
        expected_text: The expected text in the clipboard after clicking
    """
    Clipboard.clear()
    browser_environment.open_popup()
    try:
        copy_button = browser_environment.driver.find_element(By.ID, button_id)
        copy_button.click()
        clipboard_text = browser_environment.window.poll_clipboard_content()
        assert clipboard_text == expected_text
    finally:
        # closes the popup window
        browser_environment.close_popup()
