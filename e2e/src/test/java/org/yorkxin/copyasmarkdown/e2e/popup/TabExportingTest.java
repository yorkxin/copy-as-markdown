package org.yorkxin.copyasmarkdown.e2e.popup;

import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;
import org.yorkxin.copyasmarkdown.e2e.DemoPageData;

import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.io.IOException;
import java.text.MessageFormat;

import static org.testng.Assert.*;

public class TabExportingTest extends BaseTest {
    @BeforeClass
    public void setUp() {
        grantPermission("tabs");
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
    }

    @Test(dataProvider = "listStyles")
    public void allTabsAsList(String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        assertTrue(popupPage.allTabsListButton.isDisplayed());
        setListStyle(listStyle);
        driver.switchTo().window(popupHandle);
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
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }

    @Test
    public void allTabsAsTaskList() throws IOException, UnsupportedFlavorException, InterruptedException {
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
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }

    @Test(dataProvider = "listStyles")
    public void allTabsAsTitleList(String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        assertTrue(popupPage.allTabsTitleButton.isDisplayed());
        setListStyle(listStyle);
        driver.switchTo().window(popupHandle);
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
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }

    @Test(dataProvider = "listStyles")
    public void allTabsAsUrlList(String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        assertTrue(popupPage.allTabsUrlButton.isDisplayed());
        setListStyle(listStyle);
        driver.switchTo().window(popupHandle);
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
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }

    @Test(dataProvider = "listStyles")
    public void highlightedTabsAsList(String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        assertTrue(popupPage.highlightedTabsListButton.isDisplayed());
        setListStyle(listStyle);
        driver.switchTo().window(popupHandle);
        popupPage.highlightedTabsListButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                        {0} [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                        {0} [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                        {0} [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""",
                expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }

    @Test
    public void highlightedTabsAsTaskList() throws IOException, UnsupportedFlavorException, InterruptedException {
        assertTrue(popupPage.highlightedTabsTaskListButton.isDisplayed());
        popupPage.highlightedTabsTaskListButton.click();
        Thread.sleep(200);
        String expected = """
                - [ ] [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [ ] [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }

    @Test(dataProvider = "listStyles")
    public void highlightedTabsAsTitleList(String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        assertTrue(popupPage.highlightedTabsTitleButton.isDisplayed());
        setListStyle(listStyle);
        driver.switchTo().window(popupHandle);
        popupPage.highlightedTabsTitleButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                        {0} Page 0 - Copy as Markdown
                        {0} Page 2 - Copy as Markdown
                        {0} Page 4 - Copy as Markdown""",
                expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }

    @Test(dataProvider = "listStyles")
    public void highlightedTabsAsUrlList(String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        assertTrue(popupPage.highlightedTabsUrlButton.isDisplayed());
        setListStyle(listStyle);
        driver.switchTo().window(popupHandle);
        popupPage.highlightedTabsUrlButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                        {0} http://localhost:5566/0.html
                        {0} http://localhost:5566/2.html
                        {0} http://localhost:5566/4.html""",
                expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }
}
