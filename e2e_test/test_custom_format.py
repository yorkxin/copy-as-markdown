from textwrap import dedent
from typing import Optional
from e2e_test.conftest import BrowserEnvironment, FixtureServer
from selenium.webdriver.common.by import By
import pytest

class TestCustomFormat:
    browser: Optional[BrowserEnvironment] = None
    fixture_server: Optional[FixtureServer] = None
    all_keyboard_shortcuts = None

    @pytest.fixture(scope="class", autouse=True)
    def setup_browser(self, browser_environment: BrowserEnvironment, fixture_server: FixtureServer):
        self.__class__.browser = browser_environment
        self.__class__.fixture_server = fixture_server

    def test_custom_format_single_link(self):
        driver = self.__class__.browser.driver
        # go to the custom format page
        driver.get(self.__class__.browser.custom_format_page_url("single-link", 1))

        # set the name
        driver.find_element(By.ID, "input-name").clear()
        driver.find_element(By.ID, "input-name").send_keys("My Format 1")

        # set the template
        driver.find_element(By.ID, "input-template").send_keys("[{{url}} {{title}}]")

        # assert the preview is updated
        assert driver.find_element(By.ID, "preview").get_attribute("value") == "[https://example.com/1 Example 1]"

        # save
        driver.find_element(By.ID, "save").click()

        # reload
        driver.refresh()

        # assert the custom format is saved
        assert driver.find_element(By.ID, "input-name").get_attribute("value") == "My Format 1"
        assert driver.find_element(By.ID, "input-template").get_attribute("value") == "[{{url}} {{title}}]"
        assert driver.find_element(By.ID, "preview").get_attribute("value") == "[https://example.com/1 Example 1]"

    def test_custom_format_multiple_links(self):
        template = dedent("""
            {{#links}}
            - [{{title}}][{{number}}]
            {{/links}}

            {{#links}}
            [{{number}}]:{{url}}
            {{/links}}
        """).lstrip()

        rendered_template = dedent("""
            - [Example 1][1]
            - [Example 2][2]
            - [Example 3][3]
            - [Example 4][4]
            - [Example 5][5]
            - [Example 6][6]
            - [Example 7][7]

            [1]:https://example.com/1
            [2]:https://example.com/2
            [3]:https://example.com/3
            [4]:https://example.com/4
            [5]:https://example.com/5
            [6]:https://example.com/6
            [7]:https://example.com/7
        """).lstrip()

        driver = self.__class__.browser.driver
        # go to the custom format page
        driver.get(self.__class__.browser.custom_format_page_url("multiple-links", 1))

        # set the name
        driver.find_element(By.ID, "input-name").clear()
        driver.find_element(By.ID, "input-name").send_keys("My Format 2")

        # set the template
        driver.find_element(By.ID, "input-template").send_keys(template)

        # assert the preview is updated
        assert driver.find_element(By.ID, "preview").get_attribute("value") == rendered_template

        # save
        driver.find_element(By.ID, "save").click()

        # reload
        driver.refresh()

        # assert the custom format is saved
        assert driver.find_element(By.ID, "input-name").get_attribute("value") == "My Format 2"
        assert driver.find_element(By.ID, "input-template").get_attribute("value") == template
        assert driver.find_element(By.ID, "preview").get_attribute("value") == rendered_template