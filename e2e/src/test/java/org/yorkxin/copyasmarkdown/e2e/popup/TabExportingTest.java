package org.yorkxin.copyasmarkdown.e2e.popup;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.DataProvider;
import org.testng.annotations.Test;
import org.yorkxin.copyasmarkdown.e2e.DemoPageData;

import java.awt.*;
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.io.IOException;
import java.text.MessageFormat;

import static org.testng.Assert.*;

public class TabExportingTest extends BaseTest {
    @BeforeMethod
    public void setUp() {
        grantPermission("tabs");
    }

    private void testNoPermission(WebElement button) throws AWTException {
        // test that pressing keyboard shortcuts opens permissions dialog
        // if tabs permission is not enabled
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

    @Test(dataProvider = "listStyles")
    public void allTabsAsList(String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException, AWTException {
        setListStyle(listStyle);
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        assertTrue(popupPage.allTabsListButton.isDisplayed());
        popupPage.allTabsListButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                {0} [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                {0} [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
                {0} [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                {0} [Page 3 - Copy as Markdown](http://localhost:5566/3.html)
                {0} [Page 4 - Copy as Markdown](http://localhost:5566/4.html)
                {0} [Page 5 - Copy as Markdown](http://localhost:5566/5.html)""",
        expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
        testNoPermission(popupPage.allTabsListButton);
    }

    @Test
    public void allTabsAsTaskList() throws IOException, UnsupportedFlavorException, InterruptedException, AWTException {
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        assertTrue(popupPage.allTabsTaskListButton.isDisplayed());
        popupPage.allTabsTaskListButton.click();
        Thread.sleep(200);
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

    @Test(dataProvider = "listStyles")
    public void allTabsAsTitleList(String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException, AWTException {
        setListStyle(listStyle);
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        assertTrue(popupPage.allTabsTitleButton.isDisplayed());
        popupPage.allTabsTitleButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                {0} Page 0 - Copy as Markdown
                {0} Page 1 - Copy as Markdown
                {0} Page 2 - Copy as Markdown
                {0} Page 3 - Copy as Markdown
                {0} Page 4 - Copy as Markdown
                {0} Page 5 - Copy as Markdown""",
        expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
        testNoPermission(popupPage.allTabsTitleButton);
    }

    @Test(dataProvider = "listStyles")
    public void allTabsAsUrlList(String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException, AWTException {
        setListStyle(listStyle);
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        assertTrue(popupPage.allTabsUrlButton.isDisplayed());
        popupPage.allTabsUrlButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                {0} http://localhost:5566/0.html
                {0} http://localhost:5566/1.html
                {0} http://localhost:5566/2.html
                {0} http://localhost:5566/3.html
                {0} http://localhost:5566/4.html
                {0} http://localhost:5566/5.html""",
        expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
        testNoPermission(popupPage.allTabsUrlButton);
    }

    @Test(dataProvider = "listStyles")
    public void highlightedTabsAsList(String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException, AWTException {
        setListStyle(listStyle);
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        assertTrue(popupPage.highlightedTabsListButton.isDisplayed());
        popupPage.highlightedTabsListButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                {0} [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                {0} [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                {0} [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""",
        expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
        testNoPermission(popupPage.highlightedTabsListButton);
    }

    @Test
    public void highlightedTabsAsTaskList() throws IOException, UnsupportedFlavorException, InterruptedException, AWTException {
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        assertTrue(popupPage.highlightedTabsTaskListButton.isDisplayed());
        popupPage.highlightedTabsTaskListButton.click();
        Thread.sleep(200);
        String expected = """
                - [ ] [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [ ] [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
        testNoPermission(popupPage.highlightedTabsTaskListButton);
    }

    @Test(dataProvider = "listStyles")
    public void highlightedTabsAsTitleList(String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException, AWTException {
        setListStyle(listStyle);
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        assertTrue(popupPage.highlightedTabsTitleButton.isDisplayed());
        popupPage.highlightedTabsTitleButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                {0} Page 0 - Copy as Markdown
                {0} Page 2 - Copy as Markdown
                {0} Page 4 - Copy as Markdown""",
        expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
        testNoPermission(popupPage.highlightedTabsTitleButton);
    }

    @Test(dataProvider = "listStyles")
    public void highlightedTabsAsUrlList(String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException, AWTException {
        setListStyle(listStyle);
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        assertTrue(popupPage.highlightedTabsUrlButton.isDisplayed());
        popupPage.highlightedTabsUrlButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                {0} http://localhost:5566/0.html
                {0} http://localhost:5566/2.html
                {0} http://localhost:5566/4.html""",
        expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
        testNoPermission(popupPage.highlightedTabsUrlButton);
    }
}
