package org.yorkxin.copyasmarkdown.e2e;

import com.sun.net.httpserver.HttpServer;
import io.github.sukgu.Shadow;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxOptions;
import org.openqa.selenium.firefox.FirefoxProfile;
import org.openqa.selenium.interactions.Actions;
import org.testng.annotations.*;

import java.awt.*;
import java.awt.datatransfer.Clipboard;
import java.awt.datatransfer.StringSelection;
import java.awt.event.KeyEvent;
import java.io.File;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.sun.net.httpserver.SimpleFileServer.createFileHandler;

public class BaseTest {
    protected String browser;
    protected WebDriver driver;
    private HttpServer server;
    protected String extId;
    protected String e2eExtId;
    protected String mainWindowHandle;
    protected String demoWindowHandle;
    protected Clipboard clipboard;

    protected final static String BROWSER_CHROME = "chrome";
    protected final static String BROWSER_FIREFOX = "firefox";

    @DataProvider(name = "indentationsAndListStyles")
    public static Object[][] indentationsAndListStyles() {
        return new Object[][] {
                {"spaces", "dash"},
                {"spaces", "asterisk"},
                {"spaces", "plus"},
                {"tab", "dash"},
                {"tab", "asterisk"},
                {"tab", "plus"},
        };
    }

    public static String[] getAllIndentations() {
        return new String[]{
                "spaces",
                "tab",
        };
    }

    @DataProvider(name = "indentations")
    public static Object[][] indentations() {
        return new Object[][] {
                {"spaces"},
                {"tab"},
        };
    }

    public static String[] getAllListStyles() {
        return new String[]{
            "dash",
            "asterisk",
            "plus",
        };
    }

    @DataProvider(name = "listStyles")
    public static Object[][] listStyles() {
        return new Object[][] {
                {"dash"},
                {"asterisk"},
                {"plus"},
        };
    }

    @Parameters("browser")
    @BeforeClass
    public void setUp(@Optional(BROWSER_CHROME) String browserName) throws IOException, AWTException {
        browser = browserName;
        driver = getDriver(browser);
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

        openE2eExtensionMainPage();
        mainWindowHandle = driver.getWindowHandle();

        if (Objects.equals(browserName, BROWSER_CHROME)) {
            preGrantAllPermissionsInChrome();
        }
    }

    private WebDriver getDriver(String browser) {
        String workingDir = System.getProperty("user.dir");
        WebDriver wd;
        switch (browser) {
            case BROWSER_CHROME: {
                String extensionDir = Paths.get(workingDir, "..", "chrome").toAbsolutePath().toString();
                String e2eExtensionDir = Paths.get(workingDir, "support", "e2e-test-extension").toString();
                ChromeOptions co = new ChromeOptions();
                // Fix the issue https://github.com/SeleniumHQ/selenium/issues/11750
                co.addArguments("--remote-allow-origins=*");
                co.addArguments("--load-extension=" + extensionDir + "," + e2eExtensionDir);
                wd = new ChromeDriver(co);
                break;
            }
            case BROWSER_FIREFOX: {
                Path workdir = Paths.get(workingDir);
                Path extensionDir = workdir.resolve("../firefox").normalize();
                Path e2eExtensionDir = workdir.resolve("support/firefox-e2e-test-extension").normalize();
                FirefoxProfile profile = new FirefoxProfile();
                profile.setPreference("intl.locale.requested", "en-us");
                profile.setPreference("extensions.webextOptionalPermissionPrompts", false);
                FirefoxOptions fo = new FirefoxOptions();
                fo.setProfile(profile);
                FirefoxDriver fd = new FirefoxDriver(fo);
                fd.installExtension(extensionDir, true);
                fd.installExtension(e2eExtensionDir, true);
                wd = fd;
                break;
            }
            default:
                throw new IllegalArgumentException("unsupported browser: "+browser);
        }

        wd.manage().window().maximize();
        wd.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
        return wd;
    }

    private String findExtension(String extensionName) {
        String id = "";
        switch (browser) {
            case BROWSER_CHROME -> id = findExtensionInChrome(extensionName);
            case BROWSER_FIREFOX -> id = findExtensionInFirefox(extensionName);
            default -> throw new IllegalArgumentException("unsupported browser: "+browser);
        }
        return id;
    }

    private String findExtensionInChrome(String extensionName) {
        assert browser.equals(BROWSER_CHROME);

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
            throw new IllegalArgumentException("extension not found: "+ extensionName);
        }

        return myExtension.getAttribute("id");
    }

    private String findExtensionInFirefox(String extensionName) {
        assert browser.equals(BROWSER_FIREFOX);

        driver.get("about:debugging#/runtime/this-firefox");

        WebElement myExtension = null;
        List<WebElement> extensions = driver.findElements(By.className("debug-target-item"));

        for (WebElement ext : extensions) {
            String name = ext.findElement(By.className("debug-target-item__name")).getText() ;
            if (Objects.equals(name, extensionName)){
                myExtension = ext;
                break;
            }
        }

        if (myExtension == null) {
            throw new IllegalArgumentException("extension not found: "+ extensionName);
        }

        WebElement manifestLink = myExtension.findElement(By.xpath(".//a[contains(@href,\"moz-extension\")]"));
        if (manifestLink == null) {
            throw new RuntimeException("could not find extension ID by looking for a link to manifest.json");
        }

        Pattern pattern = Pattern.compile("^moz-extension://([A-Za-z0-9\\-]+)/.+$");
        Matcher matcher = pattern.matcher(manifestLink.getAttribute("href"));
        if (!matcher.matches()) {
            throw new RuntimeException("could not find extension ID by matching the link to manifest.json");
        }

        return matcher.toMatchResult().group(1);
    }

    @BeforeMethod
    public void resetClipboard() {
        clipboard.setContents(new StringSelection("========TEST SEPARATOR========"),null);
    }

    @AfterClass
    public void tearDown() {
        driver.quit();
        server.stop(0);
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

    private void openE2eExtensionMainPage() {
        driver.get(getExtensionProtocol()+"://"+e2eExtId+"/main.html?base_url=http://localhost:5566");
    }

    protected void openOptionsPage() {
        driver.get(getExtensionProtocol()+"://"+extId+"/dist/ui/options.html");
    }

    protected void openOptionsPermissionsPage() {
        driver.get(getExtensionProtocol()+"://"+extId+"/dist/ui/options-permissions.html");
    }

    protected void openCustomFormatPage(String slot) {
        driver.get(getExtensionProtocol()+"://"+extId+"/dist/ui/custom-format.html?slot="+slot);
    }

    protected String getExtensionProtocol() {
        return switch (browser) {
            case BROWSER_CHROME -> "chrome-extension";
            case BROWSER_FIREFOX -> "moz-extension";
            default -> throw new IllegalStateException("Unexpected value: " + browser);
        };
    }

    protected DemoPageData openDemoTabs(boolean groupTabs) {
        driver.switchTo().window(mainWindowHandle);
        openE2eExtensionMainPage();
        driver.findElement(By.id("open-demo")).click();
        driver.switchTo().window(mainWindowHandle);

        // order matters - must group tabs first then highlight tabs,
        // otherwise a new group will de-highlight tabs inside it.
        if (groupTabs) {
            driver.findElement(By.id("group-tabs")).click();
        }
        driver.findElement(By.id("highlight-tabs")).click();

        String demoWindowId = driver.findElement(By.id("window-id")).getAttribute("value");
        String tab0Id = driver.findElement(By.id("tab-0-id")).getAttribute("value");
        return new DemoPageData(demoWindowId, tab0Id);
    }

    protected void preGrantAllPermissionsInChrome() throws AWTException  {
        // Pre-grant all permissions for the first time when extension is installed, so that Chrome won't ask again in a dialog
        // In Chrome, go to options page, click request permission, then use Robot to accept

        // In Firefox, this is unnecessary because we can disable the prompt by setting extensions.webextOptionalPermissionPrompts = true

        assert browser.equals(BROWSER_CHROME);

        driver.switchTo().newWindow(WindowType.WINDOW);

        openOptionsPermissionsPage();
        OptionsPermissionsPage pp = new OptionsPermissionsPage(driver);

        for (WebElement button : pp.requestButtons) {
            if (!button.isEnabled()) {
                continue;
            }
            button.click();
            Robot robot = new Robot();
            robot.delay(1000);
            robot.keyPress(KeyEvent.VK_TAB);
            robot.keyRelease(KeyEvent.VK_TAB);
            robot.keyPress(KeyEvent.VK_SPACE);
            robot.keyRelease(KeyEvent.VK_SPACE);
        }

        (new Robot()).delay(200);
    }

    protected void grantPermission(String permission) {
        // Assuming that permissions have been granted by preGrantAllPermissionsInChrome() i.e. no dialog to handle
        // In Chrome, go to options page, then click request permission
        driver.switchTo().newWindow(WindowType.WINDOW);

        openOptionsPermissionsPage();
        OptionsPermissionsPage pp = new OptionsPermissionsPage(driver);
        WebElement button = pp.getRequestButton(permission);
        if (button.isEnabled()) {
            button.click();
        }

        driver.close();
        driver.switchTo().window(mainWindowHandle);
    }

    protected void removePermission(String permission) throws AWTException {
        // Assuming that permissions have been granted by preGrantAllPermissionsInChrome() i.e. no dialog to handle
        // In Chrome, go to options page, then click request permission
        driver.switchTo().newWindow(WindowType.WINDOW);

        openOptionsPermissionsPage();
        OptionsPermissionsPage pp = new OptionsPermissionsPage(driver);
        WebElement button = pp.getRemoveButton(permission);

        if (button.isEnabled()) {
            button.click();
        }

        driver.close();
        driver.switchTo().window(mainWindowHandle);
    }

    public void removeAllPermissions() throws AWTException {
        // In Chrome, go to options page, then click request permission
        driver.switchTo().newWindow(WindowType.WINDOW);

        openOptionsPermissionsPage();
        OptionsPermissionsPage pp = new OptionsPermissionsPage(driver);
        for (WebElement button : pp.removeButtons) {
            if (!button.isEnabled() || !button.isDisplayed()) {
                continue;
            }
            button.click();
        }

        driver.close();
        driver.switchTo().window(mainWindowHandle);
    }

    public void setTabGroupIndentation(String indentation) {
        assert Objects.equals(indentation, "tab") || Objects.equals(indentation, "spaces");

        driver.switchTo().newWindow(WindowType.WINDOW);
        openOptionsPage();
        String handle = driver.getWindowHandle();
        OptionsPage optionsPage = new OptionsPage(driver);
        if (indentation.equals("tab")) {
            optionsPage.tabGroupIndentationTab.click();
        } else if (indentation.equals("spaces")) {
            optionsPage.tabGroupIndentationSpaces.click();
        }
        driver.switchTo().window(handle);
        driver.close();
        driver.switchTo().window(mainWindowHandle);
    }

    public void setListStyle(String style) {
        assert Objects.equals(style, "dash") || Objects.equals(style, "asterisk") || Objects.equals(style, "plus");

        driver.switchTo().newWindow(WindowType.WINDOW);
        openOptionsPage();
        String handle = driver.getWindowHandle();
        OptionsPage optionsPage = new OptionsPage(driver);
        if (style.equals("dash")) {
            optionsPage.unorderedListCharacterDash.click();
        } else if (style.equals("asterisk")) {
            optionsPage.unorderedListCharacterAsterisk.click();
        } else if (style.equals("plus")) {
            optionsPage.unorderedListCharacterPlus.click();
        }
        driver.switchTo().window(handle);
        driver.close();
        driver.switchTo().window(mainWindowHandle);
    }

    public String expectedIndentation(String indentation){
        assert Objects.equals(indentation, "tab") || Objects.equals(indentation, "spaces");

        if (indentation.equals("tab")) {
            return "\t";
        } else if (indentation.equals("spaces")) {
            return "  ";
        };

        throw new IllegalArgumentException();
    }

    public String expectedListStyle(String style){
        assert Objects.equals(style, "dash") || Objects.equals(style, "asterisk") || Objects.equals(style, "plus");

        if (style.equals("dash")) {
            return "-";
        } else if (style.equals("asterisk")) {
            return "*";
        } else if (style.equals("plus")) {
            return "+";
        };

        throw new IllegalArgumentException();
    }
}
