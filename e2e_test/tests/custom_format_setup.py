import time
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from textwrap import dedent

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
