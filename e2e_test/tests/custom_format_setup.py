import time
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from textwrap import dedent
from typing import Optional, Tuple

from e2e_test.helpers import Clipboard

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
    time.sleep(1)
    driver.close()

def setup_multiple_links_custom_format(driver: WebDriver, extension_base_url: str, slot: int, show_in_popup: bool = True):
    """Setup custom format for multiple links in the specified slot."""
    setup_custom_format(driver, extension_base_url, "multiple-links", dedent("""
        {{#links}}
        {{number}},'{{title}}','{{url}}'
        {{/links}}
        """).strip(), slot, show_in_popup)

def setup_single_link_custom_format(driver: WebDriver, extension_base_url: str, slot: int, show_in_popup: bool = True):
    """Setup custom format for single link in the specified slot."""
    setup_custom_format(driver, extension_base_url, "single-link", "{{title}},{{url}}", slot, show_in_popup)

def setup_all_custom_formats(driver: WebDriver, extension_base_url: str):
    """Setup all custom formats used in tests."""
    original_window = driver.current_window_handle
    
    # Setup single link custom format (slot 1)
    setup_single_link_custom_format(driver, extension_base_url, slot=1)
    driver.switch_to.window(original_window)
    
    # Setup multiple links custom format (slot 1)
    setup_multiple_links_custom_format(driver, extension_base_url, slot=1)
    driver.switch_to.window(original_window)

def get_popup_url(driver: WebDriver, extension_base_url: str, window_id: str, tab_id: str) -> str:
    """Get the popup URL for the given window and tab."""
    return f"{extension_base_url}/dist/ui/popup.html?window={window_id}&tab={tab_id}&keep_open=1"

def get_window_and_tab_ids(driver: WebDriver) -> Tuple[str, str]:
    """Get the window ID and tab ID from the test helper window."""
    window_id = driver.find_element(By.ID, "window-id").get_attribute("value")
    tab_id = driver.find_element(By.ID, "tab-0-id").get_attribute("value")
    return window_id, tab_id

def test_popup_menu_action(driver: WebDriver, extension_base_url: str, button_id: str, expected_text: str) -> None:
    """Test a popup menu action and verify the clipboard content.
    
    Args:
        driver: The WebDriver instance
        extension_base_url: The base URL of the extension
        button_id: The ID of the button to click
        expected_text: The expected text in the clipboard after clicking
    """
    Clipboard.clear()
    driver.switch_to.window(driver.find_element(By.ID, "test-helper").get_attribute("value"))
    window_id, tab_id = get_window_and_tab_ids(driver)
    popup_url = get_popup_url(driver, extension_base_url, window_id, tab_id)
    driver.switch_to.new_window('window')
    try:
        driver.get(popup_url)
        copy_button = driver.find_element(By.ID, button_id)
        copy_button.click()
        time.sleep(1)
        clipboard_text = Clipboard.read()
        assert clipboard_text == expected_text
    finally:
        # No need to close the popup window, it closes itself
        driver.switch_to.window(driver.find_element(By.ID, "test-helper").get_attribute("value"))
