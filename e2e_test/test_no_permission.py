import pytest
from e2e_test.conftest import BrowserEnvironment, FixtureServer
from e2e_test.keyboard_shortcuts import KeyboardShortcuts, init_keyboard_shortcuts
from e2e_test.helpers import Clipboard
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from typing import Optional

class TestNoPermission:
    all_keyboard_shortcuts: Optional[KeyboardShortcuts] = init_keyboard_shortcuts()
    browser: Optional[BrowserEnvironment] = None
    fixture_server: Optional[FixtureServer] = None

    @pytest.fixture(scope="class", autouse=True)
    def setup_browser(self, request, browser_environment: BrowserEnvironment, fixture_server: FixtureServer):
        """Setup browser environment for all tests"""
        request.cls.browser = browser_environment
        request.cls.fixture_server = fixture_server
        
        # Configure keyboard shortcuts using shared helper
        self.browser.setup_keyboard_shortcuts(self.all_keyboard_shortcuts)

        # setup all the custom formats
        self.browser.setup_all_custom_formats()

        # Open test helper window
        self.browser.open_test_helper_window(self.fixture_server.url)
        self.browser.open_demo_window()
        self.browser.open_popup()

        yield

        self.browser.close_popup()
        self.browser.close_demo_window()

    @pytest.mark.parametrize("manifest_key", [
        "all-tabs-link-as-list",
        "all-tabs-link-as-task-list",
        "all-tabs-title-as-list",
        "all-tabs-url-as-list",
        "all-tabs-custom-format-1",
        "all-tabs-custom-format-2",
        "highlighted-tabs-link-as-list",
        "highlighted-tabs-link-as-task-list",
        "highlighted-tabs-title-as-list",
        "highlighted-tabs-url-as-list",
        "highlighted-tabs-custom-format-1",
        "highlighted-tabs-custom-format-2",
    ])
    def test_no_permission_keyboard_shortcut(self, manifest_key: str):
        self.browser.switch_to_demo_window()

        # Store a copy of the original window handles
        original_windows = self.browser.driver.window_handles.copy()

        permission_window_handle = None
        try:
            Clipboard.clear()

            # XXX: occationally, Chrome will show a bubble that stops the keyboard shortcut from being triggered.
            # We need to click the center of the window to move the focus away from the bubble.
            self.browser.window.click_center()

            self.all_keyboard_shortcuts.get_by_manifest_key(manifest_key).press()

            clipboard_text = Clipboard.read()
            assert clipboard_text == "", f"Expected empty clipboard but got {clipboard_text} with {manifest_key}"

            # wait until a new window is opened
            WebDriverWait(self.browser.driver, 3).until(
                lambda driver: len(driver.window_handles) == len(original_windows) + 1,
                "New window did not open"
            )

            diff_windows = set(self.browser.driver.window_handles) - set(original_windows)
            assert len(diff_windows) == 1, "Expected only one new window to be opened"

            permission_window_handle = diff_windows.pop()

            # switch to the permission window
            self.browser.driver.switch_to.window(permission_window_handle)

            # assert the request permission window is opened
            assert self.browser.driver.find_element(By.ID, "request-permission").is_displayed()
        finally:
            # close the request permission window
            if permission_window_handle:    
                self.browser.driver.switch_to.window(permission_window_handle)
                self.browser.driver.close()

    @pytest.mark.parametrize("manifest_key", [
        "all-tabs-link-as-list",
        "all-tabs-link-as-task-list",
        "all-tabs-title-as-list",
        "all-tabs-url-as-list",
        "all-tabs-custom-format-1",
        "all-tabs-custom-format-2",
        "highlighted-tabs-link-as-list",
        "highlighted-tabs-link-as-task-list",
        "highlighted-tabs-title-as-list",
        "highlighted-tabs-url-as-list",
        "highlighted-tabs-custom-format-1",
        "highlighted-tabs-custom-format-2",
    ])
    def test_no_permission_popup_menu(self, manifest_key: str):
        self.browser.switch_to_popup()

        # Store a copy of the original window handles
        original_windows = self.browser.driver.window_handles.copy()

        permission_window_handle = None
        try:
            Clipboard.clear()

            # print the current window title
            print(f"current window title: {self.browser.driver.title}")
            copy_button = self.browser.driver.find_element(By.ID, manifest_key)
            copy_button.click()

            clipboard_text = Clipboard.read()
            assert clipboard_text == "", f"Expected empty clipboard but got {clipboard_text} with {manifest_key}"

            # wait until a new window is opened
            WebDriverWait(self.browser.driver, 3).until(
                lambda driver: len(driver.window_handles) == len(original_windows) + 1,
                "New window did not open"
            )

            diff_windows = set(self.browser.driver.window_handles) - set(original_windows)
            assert len(diff_windows) == 1, "Expected only one new window to be opened"

            permission_window_handle = diff_windows.pop()

            # switch to the permission window
            self.browser.driver.switch_to.window(permission_window_handle)

            # assert the request permission window is opened
            assert self.browser.driver.find_element(By.ID, "request-permission").is_displayed()
        finally:
            # close the request permission window
            if permission_window_handle:    
                self.browser.driver.switch_to.window(permission_window_handle)
                self.browser.driver.close()
