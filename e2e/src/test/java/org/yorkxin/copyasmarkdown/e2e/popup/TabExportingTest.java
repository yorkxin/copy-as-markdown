package org.yorkxin.copyasmarkdown.e2e.popup;

import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;
import org.yorkxin.copyasmarkdown.e2e.DemoPageData;

import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.io.IOException;

import static org.testng.Assert.assertEquals;

public class TabExportingTest extends BaseTest {
    @BeforeMethod
    public void setUp() {
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
    }

    @Test
    public void allTabsAsList() throws IOException, UnsupportedFlavorException, InterruptedException {
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
    }

    @Test
    public void allTabsAsTaskList() throws IOException, UnsupportedFlavorException, InterruptedException {
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
    }

    @Test
    public void allTabsAsTitleList() throws IOException, UnsupportedFlavorException, InterruptedException {
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
    }

    @Test
    public void allTabsAsUrlList() throws IOException, UnsupportedFlavorException, InterruptedException {
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
    }

    @Test
    public void highlightedTabsAsList() throws IOException, UnsupportedFlavorException, InterruptedException {
        popupPage.highlightedTabsListButton.click();
        Thread.sleep(1000);
        String expected = """
                - [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test
    public void highlightedTabsAsTaskList() throws IOException, UnsupportedFlavorException, InterruptedException {
        popupPage.highlightedTabsTaskListButton.click();
        Thread.sleep(1000);
        String expected = """
                - [ ] [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [ ] [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test
    public void highlightedTabsAsTitleList() throws IOException, UnsupportedFlavorException, InterruptedException {
        popupPage.highlightedTabsTitleButton.click();
        Thread.sleep(1000);
        String expected = """
                - Page 0 - Copy as Markdown
                - Page 2 - Copy as Markdown
                - Page 4 - Copy as Markdown""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test
    public void highlightedTabsAsUrlList() throws IOException, UnsupportedFlavorException, InterruptedException {
        popupPage.highlightedTabsUrlButton.click();
        Thread.sleep(1000);
        String expected = """
                - http://localhost:5566/0.html
                - http://localhost:5566/2.html
                - http://localhost:5566/4.html""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }
}
