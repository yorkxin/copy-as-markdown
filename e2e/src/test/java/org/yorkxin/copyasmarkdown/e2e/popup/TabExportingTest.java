package org.yorkxin.copyasmarkdown.e2e.popup;

import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;
import org.yorkxin.copyasmarkdown.e2e.CustomFormatPage;
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
    }

    @Test(dataProvider = "listStyles")
    public void allTabsAsList(String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
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
                        {0} [Page 5 - Copy as Markdown](http://localhost:5566/5.html)
                        {0} [Page 6 - Copy as Markdown](http://localhost:5566/6.html)
                        {0} [Page 7 - Copy as Markdown](http://localhost:5566/7.html)""",
                expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }

    @Test
    public void allTabsAsTaskList() throws IOException, UnsupportedFlavorException, InterruptedException {
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
                - [ ] [Page 5 - Copy as Markdown](http://localhost:5566/5.html)
                - [ ] [Page 6 - Copy as Markdown](http://localhost:5566/6.html)
                - [ ] [Page 7 - Copy as Markdown](http://localhost:5566/7.html)""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }

    @Test(dataProvider = "listStyles")
    public void allTabsAsTitleList(String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
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
                        {0} Page 5 - Copy as Markdown
                        {0} Page 6 - Copy as Markdown
                        {0} Page 7 - Copy as Markdown""",
                expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }

    @Test(dataProvider = "listStyles")
    public void allTabsAsUrlList(String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
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
                        {0} http://localhost:5566/5.html
                        {0} http://localhost:5566/6.html
                        {0} http://localhost:5566/7.html""",
                expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }

    @Test(dataProvider = "listStyles")
    public void highlightedTabsAsList(String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        assertTrue(popupPage.highlightedTabsListButton.isDisplayed());
        setListStyle(listStyle);
        driver.switchTo().window(popupHandle);
        popupPage.highlightedTabsListButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                        {0} [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                        {0} [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                        {0} [Page 5 - Copy as Markdown](http://localhost:5566/5.html)""",
                expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }

    @Test
    public void highlightedTabsAsTaskList() throws IOException, UnsupportedFlavorException, InterruptedException {
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        assertTrue(popupPage.highlightedTabsTaskListButton.isDisplayed());
        popupPage.highlightedTabsTaskListButton.click();
        Thread.sleep(200);
        String expected = """
                - [ ] [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [ ] [Page 5 - Copy as Markdown](http://localhost:5566/5.html)""";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }

    @Test(dataProvider = "listStyles")
    public void highlightedTabsAsTitleList(String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        assertTrue(popupPage.highlightedTabsTitleButton.isDisplayed());
        setListStyle(listStyle);
        driver.switchTo().window(popupHandle);
        popupPage.highlightedTabsTitleButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                        {0} Page 0 - Copy as Markdown
                        {0} Page 2 - Copy as Markdown
                        {0} Page 5 - Copy as Markdown""",
                expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }

    @Test(dataProvider = "listStyles")
    public void highlightedTabsAsUrlList(String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        assertTrue(popupPage.highlightedTabsUrlButton.isDisplayed());
        setListStyle(listStyle);
        driver.switchTo().window(popupHandle);
        popupPage.highlightedTabsUrlButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                        {0} http://localhost:5566/0.html
                        {0} http://localhost:5566/2.html
                        {0} http://localhost:5566/5.html""",
                expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }

    @Test
    public void allTabsAsCustomFormat() throws InterruptedException, IOException, UnsupportedFlavorException {
        openCustomFormatPage("1");
        CustomFormatPage cfp = new CustomFormatPage(driver);

        cfp.inputName.clear();
        cfp.inputName.sendKeys("My Format 1");
        cfp.inputTemplate.sendKeys("""
                {{#links}}
                {{number}},'{{title}}','{{url}}'
                {{/links}}
                """);
        cfp.checkboxShowInPopupMenu.click();
        cfp.saveButton.click();

        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        assertTrue(popupPage.allTabsCustomFormat1.isDisplayed());
        assertEquals(popupPage.allTabsCustomFormat1.getText(), "All tabs (My Format 1)");
        driver.switchTo().window(popupHandle);
        popupPage.allTabsCustomFormat1.click();
        Thread.sleep(200);
        String expected = """
                1,'Page 0 - Copy as Markdown','http://localhost:5566/0.html'
                2,'Page 1 - Copy as Markdown','http://localhost:5566/1.html'
                3,'Page 2 - Copy as Markdown','http://localhost:5566/2.html'
                4,'Page 3 - Copy as Markdown','http://localhost:5566/3.html'
                5,'Page 4 - Copy as Markdown','http://localhost:5566/4.html'
                6,'Page 5 - Copy as Markdown','http://localhost:5566/5.html'
                7,'Page 6 - Copy as Markdown','http://localhost:5566/6.html'
                8,'Page 7 - Copy as Markdown','http://localhost:5566/7.html'
                """;
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }

    @Test
    public void highlightedTabsAsCustomFormat() throws InterruptedException, IOException, UnsupportedFlavorException {
        openCustomFormatPage("2");
        CustomFormatPage cfp = new CustomFormatPage(driver);

        cfp.inputName.clear();
        cfp.inputName.sendKeys("My Format 2");
        cfp.inputTemplate.sendKeys("""
                {{#links}}
                {{number}},'{{title}}','{{url}}'
                {{/links}}
                """);
        cfp.checkboxShowInPopupMenu.click();
        cfp.saveButton.click();

        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        assertTrue(popupPage.highlightedTabsCustomFormat2.isDisplayed());
        assertEquals(popupPage.highlightedTabsCustomFormat2.getText(), "Selected tabs (My Format 2)");
        driver.switchTo().window(popupHandle);
        popupPage.highlightedTabsCustomFormat2.click();
        Thread.sleep(200);
        String expected = """
                1,'Page 0 - Copy as Markdown','http://localhost:5566/0.html'
                2,'Page 2 - Copy as Markdown','http://localhost:5566/2.html'
                3,'Page 5 - Copy as Markdown','http://localhost:5566/5.html'
                """;
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }
}
