import ctypes
import sys
import time
import pytesseract
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from pyshadow.main import Shadow
from dataclasses import dataclass
import os
import socket

from e2e_test.helpers import Coords, Window

# Paths to your extensions
EXTENSION_PATHS = {
    "chrome": os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "chrome"),  # unpacked folder for Chrome
    "firefox": "/absolute/path/to/your/firefox_addon.xpi", # xpi file for Firefox
}

E2E_HELPER_EXTENSION_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "helper_extension")

# Set the path to the Tesseract OCR executable
if os.name == 'nt':  # Check if running on Windows
    pytesseract.pytesseract.tesseract_cmd = os.getenv('TESSERACT_PATH', 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe')

class BrowserEnvironment:
    extension_id: str
    helper_extension_id: str
    brand: str # chrome or firefox
    driver: webdriver.Chrome|webdriver.Firefox
    window: Window
    _extension_base_url: str
    _test_helper_window_handle: str
    _demo_window_handle: str

    def __init__(self, extension_id, helper_extension_id, brand, driver):
        self.extension_id = extension_id
        self.helper_extension_id = helper_extension_id
        self.brand = brand
        self.driver = driver
        if brand == "chrome":
            self._extension_base_url = f"chrome-extension://{extension_id}"
        else:
            raise ValueError(f"Unsupported browser: {brand}")
        win_pos = driver.get_window_position()
        win_size_logical = driver.get_window_size()

        scale_factor = 1.0
        if os.name == 'nt': # Check if running on Windows
            scale_factor = get_scaling_factor()

        actual_width = int(win_size_logical['width'] * scale_factor)
        actual_height = int(win_size_logical['height'] * scale_factor)

        self.window = Window(win_pos['y'], win_pos['x'], actual_width, actual_height)

    def options_page_url(self):
        return f"{self._extension_base_url}/dist/ui/options.html"

    def options_permissions_page_url(self):
        return f"{self._extension_base_url}/dist/ui/options-permissions.html"

    def request_permission_page_url(self, permission: str):
        return f"{self._extension_base_url}/dist/ui/permissions.html?permissions={permission}"

    def macro_grant_permission(self, permission: str) -> bool:
        self.driver.switch_to.new_window('tab')
        handler = self.driver.current_window_handle
        self.driver.get(self.options_permissions_page_url())
        element = self.driver.find_element(By.CSS_SELECTOR, f"[data-request-permission='{permission}']")
        if element.is_displayed() == False or element.is_enabled() == False:
            return False

        element.click()

        for _ in range(10):
            # check if the permission is granted by calling browser API
            result = self.driver.execute_script(f"return browser.permissions.contains({{permissions: ['{permission}']}});")
            if result:
                return True

            # Try OCR
            # There is a delay until the allow button is clickable
            # so we need to check the button periodically
            time.sleep(0.2)
            
            found, bbox = self.window.find_phrase_with_ocr("Allow")
            if found:
                self.window.click(bbox.center())
                # move the mouse out of the bbox so that the next screenshot can be recognized by OCR
                self.window.move_to(Coords(bbox.right() + 100, bbox.bottom() + 100))

        # move to somewhere so that the next screenshot can be recognized by OCR
        self.window.move_to(Coords(0, 0))
    
        raise Exception("Allow button not found")

    def macro_revoke_permission(self, permission: str) -> bool:
        assert self.driver.current_url == self.options_permissions_page_url(), "visit the permissions page first"
        element = self.driver.find_element(By.CSS_SELECTOR, f"[data-remove-permission='{permission}']")
        if element.is_displayed() == False or element.is_enabled() == False:
            return False

        element.click()
        return True

    def macro_grant_permissions(self):
        assert self.driver.current_url == self.options_permissions_page_url(), "visit the permissions page first"
        for permission in ["tabs", "tabGroups"]:
            self.macro_grant_permission(permission)

    def macro_revoke_permissions(self):
        assert self.driver.current_url == self.options_permissions_page_url(), "visit the permissions page first"
        for permission in ["tabs", "tabGroups"]:
            self.macro_revoke_permission(permission)

    def macro_change_unordered_list_prefix_style(self, style: str):
        original_window = self.driver.current_window_handle
        self.driver.switch_to.new_window('tab')
        self.driver.get(self.options_page_url())

        self.driver.find_element(By.CSS_SELECTOR, f"[name=character][value='{style}']").click()
        self.driver.close()
        self.driver.switch_to.window(original_window)

    def macro_change_tab_groups_indentation(self, style: str):
        original_window = self.driver.current_window_handle
        self.driver.switch_to.new_window('tab')
        self.driver.get(self.options_page_url())
        
        self.driver.find_element(By.CSS_SELECTOR, f"[name=indentation][value='{style}']").click()
        self.driver.close()
        self.driver.switch_to.window(original_window)

    def select_all(self):
        mod = Keys.COMMAND if sys.platform == 'darwin' else Keys.CONTROL
        self.driver.find_element(By.TAG_NAME, "body").send_keys(mod + "a")

    def open_test_helper_window(self, base_url: str) -> str:
        self.driver.switch_to.new_window('tab')
        self.driver.get(f"chrome-extension://{self.helper_extension_id}/main.html?base_url={base_url}")
        self._test_helper_window_handle = self.driver.current_window_handle
        return self._test_helper_window_handle

    def open_demo_window(self) -> str:
        self.driver.switch_to.window(self._test_helper_window_handle)
        self.driver.find_element(By.ID, "open-demo").click()
        wait = WebDriverWait(self.driver, 10)
        wait.until(EC.new_window_is_opened)
        self._demo_window_handle = self.driver.window_handles[-1]
        self.driver.switch_to.window(self._demo_window_handle)
        return self._demo_window_handle

    def switch_to_demo_window(self):
        """Switch to the demo window via the test helper window"""
        self.driver.switch_to.window(self._test_helper_window_handle)
        self.driver.find_element(By.ID, "switch-to-demo").click()

    def set_highlighted_tabs(self):
        """
        Set highlighted tabs in the demo window

        NOTE: This function must be called *AFTER* set_grouped_tabs(), because
        tab grouping will dismiss all the highlighted tabs.
        """
        self.driver.switch_to.window(self._test_helper_window_handle)
        self.driver.find_element(By.ID, "highlight-tabs").click()

    def set_grouped_tabs(self):
        self.driver.switch_to.window(self._test_helper_window_handle)
        self.driver.find_element(By.ID, "group-tabs").click()

    def ungroup_tabs(self):
        self.driver.switch_to.window(self._test_helper_window_handle)
        self.driver.find_element(By.ID, "ungroup-tabs").click()

    def close_demo_window(self):
        self.driver.switch_to.window(self._test_helper_window_handle)
        self.driver.find_element(By.ID, "close-demo").click()
        self._demo_window_handle = None

@pytest.fixture(params=["chrome"], scope="class")
def browser_environment(request):
    try:
        browser = request.param

        if browser == "chrome":
            options = webdriver.ChromeOptions()
            # options.add_argument("--headless=new")  # use headless new mode
            options.add_argument("--disable-gpu")
            options.add_argument("--lang=en-US")
            options.add_argument(f"--load-extension={EXTENSION_PATHS['chrome']},{E2E_HELPER_EXTENSION_PATH}")
            driver = webdriver.Chrome(options=options)

            extension_id = None
            # find extension id

            extension_id = _find_extension_id_for_chrome("Copy as Markdown", driver)
            if extension_id is None:
                raise ValueError("Extension ID not found")

            helper_extension_id = _find_extension_id_for_chrome("Copy as Markdown E2E Test Helper", driver)
            if helper_extension_id is None:
                raise ValueError("Helper extension ID not found")
            
        elif browser == "firefox":
            options = webdriver.FirefoxOptions()
            options.add_argument("--headless")
            profile = webdriver.FirefoxProfile()
            driver = webdriver.Firefox(options=options, firefox_profile=profile)
            driver.install_addon(EXTENSION_PATHS['firefox'], temporary=True)

        else:
            raise ValueError(f"Unsupported browser: {browser}")

        yield BrowserEnvironment(extension_id, helper_extension_id, browser, driver)
    finally:
        driver.quit()

def _find_extension_id_for_chrome(name: str, driver: webdriver.Chrome):
    assert isinstance(driver, webdriver.Chrome), "This function is only for Chrome"
    
    driver.get("chrome://extensions/")
    shadow = Shadow(driver)

    for element in shadow.find_elements("extensions-item"):
        if shadow.find_element(element, "#name").text == name:
            return element.get_attribute("id")
    return None

class FixtureServer:
    def __init__(self):
        self.server = None
        self.server_thread = None
        self.port = None

    @property
    def url(self):
        return f"http://localhost:{self.port}"

    def start(self):
        import http.server
        import threading
        import socket

        # Get the absolute path to the fixtures directory
        fixtures_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..','fixtures')
        
        # Find an available port
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('', 0))
            self.port = s.getsockname()[1]
        
        # Create and start the server in a separate thread
        self.server = http.server.HTTPServer(("", self.port), 
            lambda *args: http.server.SimpleHTTPRequestHandler(*args, directory=fixtures_dir))
        self.server_thread = threading.Thread(target=self.server.serve_forever)
        self.server_thread.daemon = True
        self.server_thread.start()

    def stop(self):
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            self.server = None
        if self.server_thread:
            self.server_thread.join(timeout=1.0)
            self.server_thread = None

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop()

@pytest.fixture(scope="session")
def fixture_server():
    with FixtureServer() as server:
        yield server

def get_scaling_factor():
    """Get the current scaling factor for the display on Windows."""

    """   
    This function was generated by GitHub Copilot, and the author is not sure whether
    it is correct or not, but it works.

    As for why the default is 96 DPI (from Copilot):
    
    The value of 96 DPI (Dots Per Inch) as a standard or default in Windows 
    (and subsequently in many web and display contexts) is largely historical.

    In the early days of graphical user interfaces, particularly with Windows, a 
    common screen resolution was 640x480 pixels on a 13-14 inch monitor. At this 
    size and resolution, 96 DPI was a reasonable approximation that allowed a "point" 
    in typography (1/72nd of an inch) to be represented by roughly 1.33 pixels (96/72).
    This made on-screen rendering of fonts and other elements appear at a somewhat 
    predictable physical size.

    While monitor technology and resolutions have drastically changed, 96 DPI became
    an entrenched baseline in the Windows operating system for how it internally 
    calculates scaling and relates logical units (like points or inches) to 
    physical pixels. When display scaling is set to 100%, Windows assumes the display 
    is effectively 96 DPI. Higher scaling percentages (e.g., 125%, 150%) mean that 
    applications are told the effective DPI is higher (e.g., 120 DPI, 144 DPI), and 
    they should render elements larger.

    So, the `96.0` in your `get_scaling_factor` function serves as this reference point:
    *   If `dpiX.value` is 96, the scaling factor is `1.0` (100% scaling).
    *   If `dpiX.value` is 120 (common for 125% scaling), the scaling factor is `1.25`.
    *   If `dpiX.value` is 144 (common for 150% scaling), the scaling factor is `1.5`.

    It's a convention that has persisted for compatibility and consistency within 
    the Windows ecosystem.
    """


    assert os.name == 'nt', "This function is only for Windows"

    try:
        # Query DPI Awareness (Windows 10 and later)
        awareness = ctypes.c_int()
        ctypes.windll.shcore.GetProcessDpiAwareness(0, ctypes.byref(awareness))
        # Query DPI for current monitor (Windows 8.1 and later)
        monitor = ctypes.windll.user32.MonitorFromWindow(ctypes.windll.user32.GetDesktopWindow(), 2) # MONITOR_DEFAULTTONEAREST
        dpiX = ctypes.c_uint()
        dpiY = ctypes.c_uint()
        ctypes.windll.shcore.GetDpiForMonitor(monitor, 0, ctypes.byref(dpiX), ctypes.byref(dpiY)) # MDT_EFFECTIVE_DPI = 0
        return dpiX.value / 96.0  # 96 DPI is the default
    except (AttributeError, OSError):
        # Fallback for older Windows or if shcore.dll is not found
        try:
            # GetDeviceCaps may also be affected by DPI virtualization
            # but it's a common fallback.
            # Constants for GetDeviceCaps
            LOGPIXELSX = 88
            # Get a device context for the entire screen
            dc = ctypes.windll.user32.GetDC(0)
            # Get the logical pixels per inch in the X direction
            dpi_x = ctypes.windll.gdi32.GetDeviceCaps(dc, LOGPIXELSX)
            # Release the device context
            ctypes.windll.user32.ReleaseDC(0, dc)
            return dpi_x / 96.0
        except (AttributeError, OSError):
            return 1.0 # Default to no scaling if all else fails

