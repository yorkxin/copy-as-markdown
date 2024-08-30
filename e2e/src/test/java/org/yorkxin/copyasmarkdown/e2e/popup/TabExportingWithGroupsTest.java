package org.yorkxin.copyasmarkdown.e2e.popup;

import org.testng.annotations.*;
import org.yorkxin.copyasmarkdown.e2e.CustomFormatPage;
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
    }

    @Test(dataProvider = "indentationsAndListStyles")
    public void allTabsAsList(String indentation, String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        DemoPageData dpd = openDemoTabs(true);
        openPopupWindow(dpd);
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
                {1} [Page 4 - Copy as Markdown](http://localhost:5566/4.html)
                {1} Untitled green group
                {0}{1} [Page 5 - Copy as Markdown](http://localhost:5566/5.html)
                {0}{1} [Page 6 - Copy as Markdown](http://localhost:5566/6.html)
                {1} [Page 7 - Copy as Markdown](http://localhost:5566/7.html)""",
                expectedIndentation(indentation),
                expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test(dataProvider = "indentations")
    public void allTabsAsTaskList(String indentation) throws IOException, UnsupportedFlavorException, InterruptedException {
        DemoPageData dpd = openDemoTabs(true);
        openPopupWindow(dpd);
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
                - [ ] [Page 4 - Copy as Markdown](http://localhost:5566/4.html)
                - [ ] Untitled green group
                {0}- [ ] [Page 5 - Copy as Markdown](http://localhost:5566/5.html)
                {0}- [ ] [Page 6 - Copy as Markdown](http://localhost:5566/6.html)
                - [ ] [Page 7 - Copy as Markdown](http://localhost:5566/7.html)""",
                expectedIndentation(indentation));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test(dataProvider = "indentationsAndListStyles")
    public void allTabsAsTitleList(String indentation, String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        DemoPageData dpd = openDemoTabs(true);
        openPopupWindow(dpd);
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
                {1} Page 4 - Copy as Markdown
                {1} Untitled green group
                {0}{1} Page 5 - Copy as Markdown
                {0}{1} Page 6 - Copy as Markdown
                {1} Page 7 - Copy as Markdown""",
                expectedIndentation(indentation), expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test(dataProvider = "indentationsAndListStyles")
    public void allTabsAsUrlList(String indentation, String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        DemoPageData dpd = openDemoTabs(true);
        openPopupWindow(dpd);
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
                {1} http://localhost:5566/4.html
                {1} Untitled green group
                {0}{1} http://localhost:5566/5.html
                {0}{1} http://localhost:5566/6.html
                {1} http://localhost:5566/7.html""",
                expectedIndentation(indentation), expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test(dataProvider = "indentationsAndListStyles")
    public void highlightedTabsAsList(String indentation, String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        DemoPageData dpd = openDemoTabs(true);
        openPopupWindow(dpd);
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
                {0}{1} [Page 5 - Copy as Markdown](http://localhost:5566/5.html)""",
                expectedIndentation(indentation), expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test(dataProvider = "indentations")
    public void highlightedTabsAsTaskList(String indentation) throws IOException, UnsupportedFlavorException, InterruptedException {
        DemoPageData dpd = openDemoTabs(true);
        openPopupWindow(dpd);
        setTabGroupIndentation(indentation);
        driver.switchTo().window(popupHandle);
        popupPage.highlightedTabsTaskListButton.click();
        Thread.sleep(200);
        String expected = MessageFormat.format("""
                - [ ] [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - [ ] Group 1
                {0}- [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [ ] Untitled green group
                {0}- [ ] [Page 5 - Copy as Markdown](http://localhost:5566/5.html)""",
                expectedIndentation(indentation));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test(dataProvider = "indentationsAndListStyles")
    public void highlightedTabsAsTitleList(String indentation, String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        DemoPageData dpd = openDemoTabs(true);
        openPopupWindow(dpd);
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
                {0}{1} Page 5 - Copy as Markdown""",
                expectedIndentation(indentation), expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test(dataProvider = "indentationsAndListStyles")
    public void highlightedTabsAsUrlList(String indentation, String listStyle) throws IOException, UnsupportedFlavorException, InterruptedException {
        DemoPageData dpd = openDemoTabs(true);
        openPopupWindow(dpd);
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
                {0}{1} http://localhost:5566/5.html""",
                expectedIndentation(indentation), expectedListStyle(listStyle));
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }


    @Test
    public void allTabsAsCustomFormat() throws InterruptedException, IOException, UnsupportedFlavorException {
        openCustomFormatPage("multiple-links", "1");
        CustomFormatPage cfp = new CustomFormatPage(driver);

        cfp.inputName.clear();
        cfp.inputName.sendKeys("My Format 1");
        cfp.inputTemplate.sendKeys("""
                {{#grouped}}
                {{number}},title='{{title}}',url='{{url}}',isGroup={{isGroup}}
                {{#links}}
                  {{number}},title='{{title}}',url='{{url}}'
                {{/links}}
                {{/grouped}}
                """);
        cfp.checkboxShowInMenus.click();
        cfp.saveButton.click();

        DemoPageData dpd = openDemoTabs(true);
        openPopupWindow(dpd);
        assertTrue(popupPage.allTabsCustomFormat1.isDisplayed());
        assertEquals(popupPage.allTabsCustomFormat1.getText(), "All tabs (My Format 1)");
        driver.switchTo().window(popupHandle);
        popupPage.allTabsCustomFormat1.click();
        Thread.sleep(200);
        String expected = """
                1,title='Page 0 - Copy as Markdown',url='http://localhost:5566/0.html',isGroup=false
                2,title='Group 1',url='',isGroup=true
                  1,title='Page 1 - Copy as Markdown',url='http://localhost:5566/1.html'
                  2,title='Page 2 - Copy as Markdown',url='http://localhost:5566/2.html'
                3,title='Page 3 - Copy as Markdown',url='http://localhost:5566/3.html',isGroup=false
                4,title='Page 4 - Copy as Markdown',url='http://localhost:5566/4.html',isGroup=false
                5,title='Untitled green group',url='',isGroup=true
                  1,title='Page 5 - Copy as Markdown',url='http://localhost:5566/5.html'
                  2,title='Page 6 - Copy as Markdown',url='http://localhost:5566/6.html'
                6,title='Page 7 - Copy as Markdown',url='http://localhost:5566/7.html',isGroup=false
                """;
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }

    @Test
    public void highlightedTabsAsCustomFormat() throws InterruptedException, IOException, UnsupportedFlavorException {
        openCustomFormatPage("multiple-links", "2");
        CustomFormatPage cfp = new CustomFormatPage(driver);

        cfp.inputName.clear();
        cfp.inputName.sendKeys("My Format 2");
        cfp.inputTemplate.sendKeys("""
                {{#grouped}}
                {{number}},title='{{title}}',url='{{url}}',isGroup={{isGroup}}
                {{#links}}
                  {{number}},title='{{title}}',url='{{url}}'
                {{/links}}
                {{/grouped}}
                """);
        cfp.checkboxShowInMenus.click();
        cfp.saveButton.click();

        DemoPageData dpd = openDemoTabs(true);
        openPopupWindow(dpd);
        assertTrue(popupPage.highlightedTabsCustomFormat2.isDisplayed());
        assertEquals(popupPage.highlightedTabsCustomFormat2.getText(), "Selected tabs (My Format 2)");
        driver.switchTo().window(popupHandle);
        popupPage.highlightedTabsCustomFormat2.click();
        Thread.sleep(200);
        String expected = """
                1,title='Page 0 - Copy as Markdown',url='http://localhost:5566/0.html',isGroup=false
                2,title='Group 1',url='',isGroup=true
                  1,title='Page 2 - Copy as Markdown',url='http://localhost:5566/2.html'
                3,title='Untitled green group',url='',isGroup=true
                  1,title='Page 5 - Copy as Markdown',url='http://localhost:5566/5.html'
                """;
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }
}
