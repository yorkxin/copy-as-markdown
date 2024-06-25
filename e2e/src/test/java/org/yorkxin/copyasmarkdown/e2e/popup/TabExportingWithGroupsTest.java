package org.yorkxin.copyasmarkdown.e2e.popup;

import org.testng.annotations.*;
import org.yorkxin.copyasmarkdown.e2e.DemoPageData;

import static org.testng.Assert.*;

import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.io.IOException;

public class TabExportingWithGroupsTest extends org.yorkxin.copyasmarkdown.e2e.popup.BaseTest {
    @BeforeMethod
    public void setUp() {
        grantPermission("tabs");
        grantPermission("tabGroups");
        DemoPageData dpd = openDemoTabs(true);
        openPopupWindow(dpd);
    }

    @Test
    public void allTabsAsList() throws IOException, UnsupportedFlavorException, InterruptedException {
        popupPage.allTabsListButton.click();
        Thread.sleep(1000);
        String expected = """
                - [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - Group 1
                  - [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
                  - [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [Page 3 - Copy as Markdown](http://localhost:5566/3.html)
                - Untitled green group
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
                - [ ] Group 1
                  - [ ] [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
                  - [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [ ] [Page 3 - Copy as Markdown](http://localhost:5566/3.html)
                - [ ] Untitled green group
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
                - Group 1
                  - Page 1 - Copy as Markdown
                  - Page 2 - Copy as Markdown
                - Page 3 - Copy as Markdown
                - Untitled green group
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
                - Group 1
                  - http://localhost:5566/1.html
                  - http://localhost:5566/2.html
                - http://localhost:5566/3.html
                - Untitled green group
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
                - Group 1
                  - [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - Untitled green group
                  - [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test
    public void highlightedTabsAsTaskList() throws IOException, UnsupportedFlavorException, InterruptedException {
        popupPage.highlightedTabsTaskListButton.click();
        Thread.sleep(1000);
        String expected = """
                - [ ] [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - [ ] Group 1
                  - [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [ ] Untitled green group
                  - [ ] [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test
    public void highlightedTabsAsTitleList() throws IOException, UnsupportedFlavorException, InterruptedException {
        popupPage.highlightedTabsTitleButton.click();
        Thread.sleep(1000);
        String expected = """
                - Page 0 - Copy as Markdown
                - Group 1
                  - Page 2 - Copy as Markdown
                - Untitled green group
                  - Page 4 - Copy as Markdown""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test
    public void highlightedTabsAsUrlList() throws IOException, UnsupportedFlavorException, InterruptedException {
        popupPage.highlightedTabsUrlButton.click();
        Thread.sleep(1000);
        String expected = """
                - http://localhost:5566/0.html
                - Group 1
                  - http://localhost:5566/2.html
                - Untitled green group
                  - http://localhost:5566/4.html""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }
}
