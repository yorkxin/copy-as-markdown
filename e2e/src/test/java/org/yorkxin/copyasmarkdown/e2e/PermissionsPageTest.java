package org.yorkxin.copyasmarkdown.e2e;

import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WindowType;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.awt.*;
import java.util.List;
import java.util.Set;

import static org.testng.Assert.*;

public class PermissionsPageTest extends BaseTest {
    private String permissionsWindowHandle;

    public void openPermissionsPage() {
        driver.switchTo().newWindow(WindowType.WINDOW);
        permissionsWindowHandle = driver.getWindowHandle();
        driver.get(getExtensionProtocol()+"://"+extId+"/dist/ui/permissions.html?permissions=tabs");
    }

    @AfterMethod
    public void cleanup() {
        driver.switchTo().window(mainWindowHandle);
    }

    @Test
    public void testRequestPermission() throws AWTException {
        removePermission("tabs");
        openPermissionsPage();
        PermissionsPage page = new PermissionsPage(driver);
        assertTrue(page.requestButton.isDisplayed());
        assertTrue(page.requestButton.isEnabled());
        assertEquals(page.requestButton.getText(), "Grant Permissions");

        page.requestButton.click();
        assertFalse(page.requestButton.isEnabled());

        JavascriptExecutor js = (JavascriptExecutor) driver;
        Boolean response = (Boolean) js.executeAsyncScript(
                "var callback = arguments[arguments. length - 1];"+
                "chrome.permissions.contains({ permissions: [\"tabs\"] }, callback);"
        );
        assertTrue(response);
        driver.close();
    }

    @Test
    public void testAlreadyGranted() {
        grantPermission("tabs");
        openPermissionsPage();
        PermissionsPage page = new PermissionsPage(driver);
        assertTrue(page.requestButton.isDisplayed());
        assertFalse(page.requestButton.isEnabled());
        assertEquals(page.requestButton.getText(), "Granted!");
        driver.close();
    }

    @Test
    public void testClose() {
        openPermissionsPage();
        PermissionsPage page = new PermissionsPage(driver);
        assertTrue(page.closeButton.isDisplayed());
        assertTrue(page.closeButton.isEnabled());
        assertEquals(page.closeButton.getText(), "Close");

        page.closeButton.click();
        assertFalse(driver.getWindowHandles().contains(permissionsWindowHandle));
    }
}
