package org.yorkxin.copyasmarkdown.e2e;

import org.openqa.selenium.By;
import org.openqa.selenium.WindowType;
import org.testng.annotations.*;
import static org.testng.Assert.*;

import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.io.IOException;

public class PopupPageTest extends BaseTest {
    private PopupPage popupPage;
    private String popupHandle;

    @BeforeMethod
    public void openPopupWindow() {
        openDemoTabs();

        String demoWindowId = driver.findElement(By.id("window-id")).getAttribute("value");
        String tab0Id = driver.findElement(By.id("tab-0-id")).getAttribute("value");

        // Open popup
        driver.switchTo().newWindow(WindowType.WINDOW)
                .get("chrome-extension://"+extId+"/dist/ui/popup.html?window="+demoWindowId+"&tab="+tab0Id+"&keep_open=1");

        popupHandle = driver.getWindowHandle();
        popupPage = new PopupPage(driver);
    }

    @AfterMethod
    public void closePopupWindow() {
        driver.switchTo().window(popupHandle).close();
        driver.switchTo().window(mainWindowHandle);
        driver.findElement(By.id("close-demo")).click();
    }

    @Test
    public void counter() throws IOException, UnsupportedFlavorException {
        assertEquals("6", popupPage.counterAll.getText());
        assertEquals("3", popupPage.counterHighlighted.getText());
    }

    @Test
    public void currentTabLink() throws IOException, UnsupportedFlavorException, InterruptedException {
        popupPage.currentTabLinkButton.click();
        Thread.sleep(1000);
        String expected = "[Page 0 - Copy as Markdown](http://localhost:5566/0.html)";
        assertEquals(expected,clipboard.getData(DataFlavor.stringFlavor));
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
        assertEquals(expected,clipboard.getData(DataFlavor.stringFlavor));
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
        assertEquals(expected,clipboard.getData(DataFlavor.stringFlavor));
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
        assertEquals(expected,clipboard.getData(DataFlavor.stringFlavor));
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
        assertEquals(expected,clipboard.getData(DataFlavor.stringFlavor));
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
        assertEquals(expected,clipboard.getData(DataFlavor.stringFlavor));
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
        assertEquals(expected,clipboard.getData(DataFlavor.stringFlavor));
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
        assertEquals(expected,clipboard.getData(DataFlavor.stringFlavor));
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
        assertEquals(expected,clipboard.getData(DataFlavor.stringFlavor));
    }
}
