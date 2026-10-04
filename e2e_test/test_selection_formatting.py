import os

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

from e2e_test.helpers import Clipboard
from e2e_test.keyboard_shortcuts import init_keyboard_shortcuts


pytestmark = pytest.mark.skipif(
    os.environ.get("GNOME_ACCESSIBILITY") != "1"
    or not os.environ.get("DBUS_SESSION_BUS_ADDRESS"),
    reason="Native Firefox menu testing requires the Docker AT-SPI environment",
)


class TestSelectionFormatting:
    def test_combined_settings_through_native_shortcut_and_context_menu(
        self, accessible_browser_environment, fixture_server
    ):
        browser = accessible_browser_environment
        driver = browser.driver
        wait = WebDriverWait(driver, 10)
        shortcut = init_keyboard_shortcuts(["selection-as-markdown"]).get_by_manifest_key(
            "selection-as-markdown"
        )
        driver.get(fixture_server.url + "/selection.html")
        driver.execute_script("""
            document.body.innerHTML = '<h1><span id="menu-target">Heading</span></h1><p><em>italic</em> and '
              + '<strong>bold</strong> with <a href="https://example.com/">Example</a></p>'
              + '<ul><li>item</li></ul><pre><code class="language-js">const x = 1;\\n</code></pre>';
        """)
        source_tab = driver.current_window_handle
        driver.switch_to.new_window("tab")
        options_tab = driver.current_window_handle
        driver.get(browser.options_page_url())
        wait.until(lambda d: d.find_element(By.CSS_SELECTOR, "input[name=link-style][value=inlined]").is_selected())

        configured = {
            "selection.markdown.headingStyle": "setext",
            "selection.markdown.emDelimiter": "*",
            "selection.markdown.strongDelimiter": "__",
            "selection.markdown.bulletListMarker": "+",
            "selection.markdown.fence": "~~~",
            "selection.markdown.linkStyle": "referenced",
            "selection.markdown.linkReferenceStyle": "shortcut",
        }
        for name, value in [
            ("heading-style", "setext"),
            ("em-delimiter", "*"),
            ("strong-delimiter", "__"),
            ("bullet-list-marker", "+"),
            ("code-block-style", "fenced-tildes"),
            ("link-style", "shortcut"),
        ]:
            driver.find_element(By.CSS_SELECTOR, f'input[name="{name}"][value="{value}"]').click()

        def stored_values(keys):
            return driver.execute_async_script("""
                const done = arguments[arguments.length - 1];
                browser.storage.sync.get(arguments[0]).then(done);
            """, keys)

        wait.until(lambda d: stored_values(list(configured)) == configured)

        def copy_selection(method):
            driver.switch_to.window(source_tab)
            browser.select_all()
            Clipboard.clear()
            if method == "shortcut":
                shortcut.press()
            else:
                # Right-click selected text, not the body's empty space, so Firefox
                # opens the single-item selection context instead of a page submenu.
                browser.context_menu_click(driver.find_element(By.ID, "menu-target"), "Copy Selection as Markdown")
            return Clipboard.poll(timeout=5)

        prefix = "Heading\n=======\n\n*italic* and __bold__ with "
        suffix = "\n\n+   item\n\n~~~js\nconst x = 1;\n~~~"
        referenced = prefix + "[Example]" + suffix + "\n\n[Example]: https://example.com/"
        assert copy_selection("shortcut") == referenced
        assert copy_selection("context-menu") == referenced

        driver.switch_to.window(options_tab)
        driver.find_element(By.CSS_SELECTOR, "input[name=link-style][value=inlined]").click()
        wait.until(lambda d: stored_values([
            "selection.markdown.linkStyle", "selection.markdown.linkReferenceStyle"
        ]) == {
            "selection.markdown.linkStyle": "inlined",
            "selection.markdown.linkReferenceStyle": "shortcut",
        })
        assert copy_selection("shortcut") == prefix + "[Example](https://example.com/)" + suffix

        driver.switch_to.window(options_tab)
        driver.find_element(By.ID, "reset").click()
        wait.until(lambda d: d.find_element(By.CSS_SELECTOR, "input[name=heading-style][value=atx]").is_selected())
        defaults = "# Heading\n\n_italic_ and **bold** with [Example](https://example.com/)\n\n"
        defaults += "-   item\n\n```js\nconst x = 1;\n```"
        assert copy_selection("shortcut") == defaults
