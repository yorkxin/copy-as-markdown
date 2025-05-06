import pytest
from selenium.webdriver.common.by import By

from e2e_test.conftest import BrowserEnvironment

class TestPermissions:
    @pytest.fixture(scope="class", autouse=True)
    def pre_grant_permissions(self, browser_environment: BrowserEnvironment):
        """Grant permissions before running the tests"""
        browser_environment.driver.get(browser_environment.options_permissions_page_url())
        browser_environment.macro_grant_permission("tabs")
        browser_environment.macro_revoke_permission("tabs")

    def test_grant_permission(self, browser_environment: BrowserEnvironment):
        driver = browser_environment.driver
        driver.get(browser_environment.request_permission_page_url('tabs'))

        body = driver.find_element(By.TAG_NAME, 'body')
        assert "The feature you are going to use requires additional permissions: tabs" in body.text

        # check that the request permission button is enabled
        btn = driver.find_element(By.ID, 'request-permission')
        assert btn.is_enabled() == True

        # click the button to grant permission
        btn.click()

        # check that the request permission button is disabled
        btn = driver.find_element(By.ID, 'request-permission')
        assert btn.is_enabled() == False

        # run a script to check that the permission is granted
        result = driver.execute_script("return browser.permissions.contains({permissions: ['tabs']})")
        assert result == True

    def test_grant_permission_close_button(self, browser_environment: BrowserEnvironment):
        driver = browser_environment.driver
        
        driver.get(browser_environment.request_permission_page_url('tabs'))
        original_window = driver.current_window_handle

        # check that the close button is enabled
        btn = driver.find_element(By.ID, 'close')
        assert btn.is_enabled() == True

        # click the button to close the page
        btn.click()

        # check that the page is closed
        # Get the list of currently open window handles
        open_windows = driver.window_handles

        # Check if the original window is closed
        assert original_window not in open_windows, "Window was not closed!"
