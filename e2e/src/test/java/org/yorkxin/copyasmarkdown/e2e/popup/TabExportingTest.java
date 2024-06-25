package org.yorkxin.copyasmarkdown.e2e.popup;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;
import org.yorkxin.copyasmarkdown.e2e.DemoPageData;

import java.awt.*;
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.io.IOException;

import static org.testng.Assert.*;

public class TabExportingTest extends BaseTest {
    @BeforeMethod
    public void setUp() {
        grantPermission("tabs");
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
    }

    private void testNoPermission(WebElement button) throws AWTException {
        // test that pressing keyboard shortcuts opens options page with error message,
        // if tabs is not enabled
        removePermission("tabs");
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);

        java.util.Set<String> windowsBefore = driver.getWindowHandles();
        button.click();

        // assert that it opens one window, which is the permissions dialog
        java.util.Set<String> windowsAfter = driver.getWindowHandles();
        windowsAfter.removeAll(windowsBefore);
        assertEquals(1, windowsAfter.size());
        driver.switchTo().window(windowsAfter.iterator().next());
        assertEquals(driver.getCurrentUrl(), getExtensionProtocol()+"://"+extId+"/dist/ui/permissions.html?permissions=tabs");
        driver.close();
        driver.switchTo().window(mainWindowHandle);
    }

    @Test
    public void allTabsAsList() throws IOException, UnsupportedFlavorException, InterruptedException, AWTException {
        assertTrue(popupPage.allTabsListButton.isDisplayed());
        popupPage.allTabsListButton.click();
        Thread.sleep(1000);
        String expected = """
                - [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
                - [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [Page 3 - Copy as Markdown](http://localhost:5566/3.html)
                - [Page 4 - Copy as Markdown](http://localhost:5566/4.html)
                - [Page 5 - Copy as Markdown](http://localhost:5566/5.html)""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
        testNoPermission(popupPage.allTabsListButton);
    }

    @Test
    public void allTabsAsTaskList() throws IOException, UnsupportedFlavorException, InterruptedException, AWTException {
        assertTrue(popupPage.allTabsTaskListButton.isDisplayed());
        popupPage.allTabsTaskListButton.click();
        Thread.sleep(1000);
        String expected = """
                - [ ] [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - [ ] [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
                - [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [ ] [Page 3 - Copy as Markdown](http://localhost:5566/3.html)
                - [ ] [Page 4 - Copy as Markdown](http://localhost:5566/4.html)
                - [ ] [Page 5 - Copy as Markdown](http://localhost:5566/5.html)""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
        testNoPermission(popupPage.allTabsTaskListButton);
    }

    @Test
    public void allTabsAsTitleList() throws IOException, UnsupportedFlavorException, InterruptedException, AWTException {
        assertTrue(popupPage.allTabsTitleButton.isDisplayed());
        popupPage.allTabsTitleButton.click();
        Thread.sleep(1000);
        String expected = """
                - Page 0 - Copy as Markdown
                - Page 1 - Copy as Markdown
                - Page 2 - Copy as Markdown
                - Page 3 - Copy as Markdown
                - Page 4 - Copy as Markdown
                - Page 5 - Copy as Markdown""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
        testNoPermission(popupPage.allTabsTitleButton);
    }

    @Test
    public void allTabsAsUrlList() throws IOException, UnsupportedFlavorException, InterruptedException, AWTException {
        assertTrue(popupPage.allTabsUrlButton.isDisplayed());
        popupPage.allTabsUrlButton.click();
        Thread.sleep(1000);
        String expected = """
                - http://localhost:5566/0.html
                - http://localhost:5566/1.html
                - http://localhost:5566/2.html
                - http://localhost:5566/3.html
                - http://localhost:5566/4.html
                - http://localhost:5566/5.html""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
        testNoPermission(popupPage.allTabsUrlButton);
    }

    @Test
    public void highlightedTabsAsList() throws IOException, UnsupportedFlavorException, InterruptedException, AWTException {
        assertTrue(popupPage.highlightedTabsListButton.isDisplayed());
        popupPage.highlightedTabsListButton.click();
        Thread.sleep(1000);
        String expected = """
                - [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
        testNoPermission(popupPage.highlightedTabsListButton);
    }

    @Test
    public void highlightedTabsAsTaskList() throws IOException, UnsupportedFlavorException, InterruptedException, AWTException {
        assertTrue(popupPage.highlightedTabsTaskListButton.isDisplayed());
        popupPage.highlightedTabsTaskListButton.click();
        Thread.sleep(1000);
        String expected = """
                - [ ] [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [ ] [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
        testNoPermission(popupPage.highlightedTabsTaskListButton);
    }

    @Test
    public void highlightedTabsAsTitleList() throws IOException, UnsupportedFlavorException, InterruptedException, AWTException {
        assertTrue(popupPage.highlightedTabsTitleButton.isDisplayed());
        popupPage.highlightedTabsTitleButton.click();
        Thread.sleep(1000);
        String expected = """
                - Page 0 - Copy as Markdown
                - Page 2 - Copy as Markdown
                - Page 4 - Copy as Markdown""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
        testNoPermission(popupPage.highlightedTabsTitleButton);
    }

    @Test
    public void highlightedTabsAsUrlList() throws IOException, UnsupportedFlavorException, InterruptedException, AWTException {
        assertTrue(popupPage.highlightedTabsUrlButton.isDisplayed());
        popupPage.highlightedTabsUrlButton.click();
        Thread.sleep(1000);
        String expected = """
                - http://localhost:5566/0.html
                - http://localhost:5566/2.html
                - http://localhost:5566/4.html""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
        testNoPermission(popupPage.highlightedTabsUrlButton);
    }
}
