package org.yorkxin.copyasmarkdown.e2e.popup;

import org.openqa.selenium.WebElement;
import org.testng.annotations.Test;
import org.yorkxin.copyasmarkdown.e2e.DemoPageData;

import java.awt.*;

import static org.testng.Assert.assertEquals;

public class NoPermissionTest  extends BaseTest {
    @Test
    public void testNoPermission() throws AWTException {
        // test that pressing keyboard shortcuts opens permissions dialog
        // if tabs permission is not enabled
        removePermission("tabs");
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);

        for (WebElement button : popupPage.allTabExportButtons) {
            java.util.Set<String> windowsBefore = driver.getWindowHandles();
            button.click();

            // assert that it opens one window, which is the permissions dialog
            java.util.Set<String> windowsAfter = driver.getWindowHandles();
            windowsAfter.removeAll(windowsBefore);
            assertEquals(1, windowsAfter.size());
            driver.switchTo().window(windowsAfter.iterator().next());
            assertEquals(driver.getCurrentUrl(), getExtensionProtocol()+"://"+extId+"/dist/ui/permissions.html?permissions=tabs");
            driver.close();
            driver.switchTo().window(popupHandle);
        }
    }
}
