import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
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

class BrowserEnvironment:
    extension_id: str
    brand: str # chrome or firefox
    driver: webdriver.Chrome|webdriver.Firefox
    window: Window
    _extension_base_url: str

    def __init__(self, extension_id, brand, driver):
        self.extension_id = extension_id
        self.brand = brand
        self.driver = driver
        if brand == "chrome":
            self._extension_base_url = f"chrome-extension://{extension_id}"
        else:
            raise ValueError(f"Unsupported browser: {brand}")
        win_pos = driver.get_window_position()
        win_size = driver.get_window_size()
        self.window = Window(win_pos['y'], win_pos['x'], win_size['width'], win_size['height'])

    def options_page_url(self):
        return f"{self._extension_base_url}/dist/ui/options.html"

    def permissions_page_url(self):
        return f"{self._extension_base_url()}/dist/ui/permissions.html"


@pytest.fixture(params=["chrome"], scope="class")
def browser_environment(request):
    try:
        browser = request.param

        if browser == "chrome":
            options = webdriver.ChromeOptions()
            # options.add_argument("--headless=new")  # use headless new mode
            options.add_argument("--disable-gpu")
            options.add_argument(f"--load-extension={EXTENSION_PATHS['chrome']}")
            driver = webdriver.Chrome(options=options)

            driver.get("chrome://extensions/")
            shadow = Shadow(driver)

            extension_id = None
            # find extension id
            for element in shadow.find_elements("extensions-item"):
                # scroll to element
                if shadow.find_element(element, "#name").text == "Copy as Markdown":
                    extension_id = element.get_attribute("id")
                    break

            if extension_id is None:
                raise ValueError("Extension ID not found")

        elif browser == "firefox":
            options = webdriver.FirefoxOptions()
            options.add_argument("--headless")
            profile = webdriver.FirefoxProfile()
            driver = webdriver.Firefox(options=options, firefox_profile=profile)
            driver.install_addon(EXTENSION_PATHS['firefox'], temporary=True)

        else:
            raise ValueError(f"Unsupported browser: {browser}")

        yield BrowserEnvironment(extension_id, browser, driver)
    finally:
        driver.quit()

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
