package org.yorkxin.copyasmarkdown.e2e.popup;

import org.openqa.selenium.By;
import org.openqa.selenium.WindowType;
import org.testng.annotations.AfterClass;
import org.yorkxin.copyasmarkdown.e2e.DemoPageData;

import static org.testng.Assert.assertEquals;

public class BaseTest extends org.yorkxin.copyasmarkdown.e2e.BaseTest {
    protected PopupPage popupPage;
    protected String popupHandle;

    public void openPopupWindow(DemoPageData dpd) {
        driver.switchTo().newWindow(WindowType.WINDOW)
                .get(getExtensionProtocol() + "://" + extId + "/dist/ui/popup.html?window=" + dpd.windowId() + "&tab=" + dpd.tab0Id() + "&keep_open=1");

        popupHandle = driver.getWindowHandle();
        popupPage = new PopupPage(driver);
    }

    @AfterClass
    public void closePopupWindow() {
        driver.switchTo().window(popupHandle).close();
        driver.switchTo().window(mainWindowHandle);
        driver.findElement(By.id("close-demo")).click();
    }
}
