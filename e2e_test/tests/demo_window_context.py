from selenium.webdriver.common.by import By
from typing import Optional
from e2e_test.conftest import BrowserEnvironment

class DemoWindowContext:
    """Context manager for demo window setup and cleanup."""
    
    def __init__(self, browser: BrowserEnvironment, set_highlighted_tabs: bool = False, set_grouped_tabs: bool = False):
        self.browser = browser
        self.set_highlighted_tabs = set_highlighted_tabs
        self.set_grouped_tabs = set_grouped_tabs
        self._original_window: Optional[str] = None

    def __enter__(self):
        # Store the current window handle
        self._original_window = self.browser.driver.current_window_handle
        
        # Open demo window which will create the test pages
        self.browser.open_demo_window()
        
        # Switch to test helper window to set up tabs
        self.browser.driver.switch_to.window(self.browser._test_helper_window_handle)
        
        # must group tabs before highlighting, otherwise, grouping will dismiss all the highlighted tabs
        if self.set_grouped_tabs:
            self.browser.driver.find_element(By.ID, "group-tabs").click()
        
        if self.set_highlighted_tabs:
            self.browser.driver.find_element(By.ID, "highlight-tabs").click()
        
        # Switch to demo window
        self.browser.driver.find_element(By.ID, "switch-to-demo").click()
        
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Cleanup: close demo window and switch back to original window
        self.browser.close_demo_window()
        if self._original_window:
            self.browser.driver.switch_to.window(self._original_window) 