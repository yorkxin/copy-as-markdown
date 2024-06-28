package org.yorkxin.copyasmarkdown.e2e.popup;

import org.testng.annotations.*;
import org.yorkxin.copyasmarkdown.e2e.DemoPageData;

import static org.testng.Assert.*;

import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.io.IOException;
import java.text.MessageFormat;

public class TabExportingWithGroupsTest extends org.yorkxin.copyasmarkdown.e2e.popup.BaseTest {
    @BeforeClass
    public void setUp() {
        grantPermission("tabs");
        grantPermission("tabGroups");
        DemoPageData dpd = openDemoTabs(true);
        openPopupWindow(dpd);
    }

    @Test(dataProvider = "indentationsAndListStyles")
    public void allTabsAsList(String indentation, String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        setTabGroupIndentation(indentation);
        setListStyle(listStyle);
        driver.switchTo().window(popupHandle);
        popupPage.allTabsListButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                {1} [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                {1} Group 1
                {0}{1} [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
                {0}{1} [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                {1} [Page 3 - Copy as Markdown](http://localhost:5566/3.html)
                {1} Untitled green group
                {0}{1} [Page 4 - Copy as Markdown](http://localhost:5566/4.html)
                {1} [Page 5 - Copy as Markdown](http://localhost:5566/5.html)""",
                expectedIndentation(indentation),
                expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test(dataProvider = "indentations")
    public void allTabsAsTaskList(String indentation) throws IOException, UnsupportedFlavorException, InterruptedException {
        setTabGroupIndentation(indentation);
        driver.switchTo().window(popupHandle);
        popupPage.allTabsTaskListButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                - [ ] [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - [ ] Group 1
                {0}- [ ] [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
                {0}- [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [ ] [Page 3 - Copy as Markdown](http://localhost:5566/3.html)
                - [ ] Untitled green group
                {0}- [ ] [Page 4 - Copy as Markdown](http://localhost:5566/4.html)
                - [ ] [Page 5 - Copy as Markdown](http://localhost:5566/5.html)""",
                expectedIndentation(indentation));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test(dataProvider = "indentationsAndListStyles")
    public void allTabsAsTitleList(String indentation, String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        setTabGroupIndentation(indentation);
        setListStyle(listStyle);
        driver.switchTo().window(popupHandle);
        popupPage.allTabsTitleButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                {1} Page 0 - Copy as Markdown
                {1} Group 1
                {0}{1} Page 1 - Copy as Markdown
                {0}{1} Page 2 - Copy as Markdown
                {1} Page 3 - Copy as Markdown
                {1} Untitled green group
                {0}{1} Page 4 - Copy as Markdown
                {1} Page 5 - Copy as Markdown""",
                expectedIndentation(indentation), expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test(dataProvider = "indentationsAndListStyles")
    public void allTabsAsUrlList(String indentation, String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        setTabGroupIndentation(indentation);
        setListStyle(listStyle);
        driver.switchTo().window(popupHandle);
        popupPage.allTabsUrlButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                {1} http://localhost:5566/0.html
                {1} Group 1
                {0}{1} http://localhost:5566/1.html
                {0}{1} http://localhost:5566/2.html
                {1} http://localhost:5566/3.html
                {1} Untitled green group
                {0}{1} http://localhost:5566/4.html
                {1} http://localhost:5566/5.html""",
                expectedIndentation(indentation), expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test(dataProvider = "indentationsAndListStyles")
    public void highlightedTabsAsList(String indentation, String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        setTabGroupIndentation(indentation);
        setListStyle(listStyle);
        driver.switchTo().window(popupHandle);
        popupPage.highlightedTabsListButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                {1} [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                {1} Group 1
                {0}{1} [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                {1} Untitled green group
                {0}{1} [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""",
                expectedIndentation(indentation), expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test(dataProvider = "indentations")
    public void highlightedTabsAsTaskList(String indentation) throws IOException, UnsupportedFlavorException, InterruptedException {
        setTabGroupIndentation(indentation);
        driver.switchTo().window(popupHandle);
        popupPage.highlightedTabsTaskListButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                - [ ] [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - [ ] Group 1
                {0}- [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [ ] Untitled green group
                {0}- [ ] [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""",
                expectedIndentation(indentation));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test(dataProvider = "indentationsAndListStyles")
    public void highlightedTabsAsTitleList(String indentation, String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        setTabGroupIndentation(indentation);
        setListStyle(listStyle);
        driver.switchTo().window(popupHandle);
        popupPage.highlightedTabsTitleButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                {1} Page 0 - Copy as Markdown
                {1} Group 1
                {0}{1} Page 2 - Copy as Markdown
                {1} Untitled green group
                {0}{1} Page 4 - Copy as Markdown""",
                expectedIndentation(indentation), expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test(dataProvider = "indentationsAndListStyles")
    public void highlightedTabsAsUrlList(String indentation, String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        setTabGroupIndentation(indentation);
        setListStyle(listStyle);
        driver.switchTo().window(popupHandle);
        popupPage.highlightedTabsUrlButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                {1} http://localhost:5566/0.html
                {1} Group 1
                {0}{1} http://localhost:5566/2.html
                {1} Untitled green group
                {0}{1} http://localhost:5566/4.html""",
                expectedIndentation(indentation), expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }
}
