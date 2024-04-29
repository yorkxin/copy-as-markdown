package org.yorkxin.copyasmarkdown.e2e;

import com.sun.net.httpserver.HttpServer;
import io.github.sukgu.Shadow;
import org.apache.commons.io.FileUtils;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.TestInstance;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;

import java.awt.*;
import java.awt.datatransfer.Clipboard;
import java.awt.datatransfer.StringSelection;
import java.io.File;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import static com.sun.net.httpserver.SimpleFileServer.createFileHandler;

record Window(String handle, String url, String title) {}

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class BaseTest {
    protected WebDriver driver;
    private HttpServer server;
    protected String extId;
    protected String e2eExtId;
    protected String mainWindowHandle;
    protected String demoWindowHandle;
    protected Clipboard clipboard;
    List<Window> windows = new ArrayList<>();

    @BeforeAll
    public void setUp() throws IOException, InterruptedException, AWTException {
        ChromeOptions options = new ChromeOptions();
        // Fix the issue https://github.com/SeleniumHQ/selenium/issues/11750
        options.addArguments("--remote-allow-origins=*");
        options.addArguments("--load-extension=../chrome,./support/e2e-test-extension");
        driver = new ChromeDriver(options);
        driver.manage().window().maximize();
        driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));

        clipboard = Toolkit.getDefaultToolkit().getSystemClipboard();

        extId = findExtension("Copy as Markdown");
        System.out.printf("Extension ID of Copy as Markdown: %s\n", extId);

        e2eExtId = findExtension("Copy as Markdown E2E Test");
        System.out.printf("Extension ID of E2E Test: %s\n", e2eExtId);

        server = HttpServer.create(new InetSocketAddress(5566), 0);
        server.createContext("/", createFileHandler(Path.of(new File("./support/pages/").getCanonicalPath())));
        server.setExecutor(null);
        server.start();
        System.out.printf("started serving on %s\n", server.getAddress());

        driver.get("chrome-extension://"+e2eExtId+"/main.html?base_url=http://localhost:5566");
        mainWindowHandle = driver.getWindowHandle();
    }

    private String findExtension(String extensionName) {
        // get extension ID
        driver.get("chrome://extensions/");

        WebElement myExtension = null;
        Shadow shadow = new Shadow(driver);
        List<WebElement> extensions = shadow.findElements("extensions-manager extensions-item-list extensions-item");

        for (WebElement ext : extensions) {
            String name = ext.getShadowRoot().findElement(By.id("name")).getText() ;
            if (Objects.equals(name, extensionName)){
                myExtension = ext;
                break;
            }
        }

        if (myExtension == null) {
            throw new IllegalArgumentException("extension not found");
        }

        return myExtension.getAttribute("id");
    }

    @BeforeEach
    public void resetClipboard() {
        clipboard.setContents(new StringSelection("========TEST SEPARATOR========"),null);
    }

    @AfterAll
    public void tearDown() {
        driver.quit();
        server.stop(0);
    }

    protected String findWindow(String title) {
        for (Window w: windows) {
            System.out.print(w);
            if (Objects.equals(w.title(), title)) {
                return w.handle();
            }
        }
        return null;
    }

    protected void selectAll() {
        Keys cmdCtrl = Platform.getCurrent().is(Platform.MAC) ? Keys.COMMAND : Keys.CONTROL;
        Actions actions = new Actions(driver);
        // select all
        actions.keyDown(cmdCtrl)
                .sendKeys("a")
                .keyUp(cmdCtrl)
                .perform();
    }

    protected void openDemoTabs() {
        driver.switchTo().window(mainWindowHandle);
        driver.findElement(By.id("open-demo")).click();
        driver.switchTo().window(mainWindowHandle);
        driver.findElement(By.id("highlight-tabs")).click();
    }
}
