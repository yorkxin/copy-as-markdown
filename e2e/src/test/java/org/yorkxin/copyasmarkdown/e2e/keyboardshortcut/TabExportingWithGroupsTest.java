package org.yorkxin.copyasmarkdown.e2e.keyboardshortcut;

import org.openqa.selenium.By;
import org.openqa.selenium.Keys;
import org.testng.annotations.*;

import java.awt.*;
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.awt.event.KeyEvent;
import java.io.IOException;

import static org.testng.Assert.assertEquals;

public class TabExportingWithGroupsTest extends BaseTest {
    @BeforeClass
    public void configureKeyboardShortcuts() throws InterruptedException, AWTException {
        switch (browser) {
            case BROWSER_CHROME -> configureKeyboardShortcutsInChrome();
            case BROWSER_FIREFOX -> configureKeyboardShortcutsInFirefox();
            default -> throw new IllegalStateException("Unexpected browser: " + browser);
        }
    }

    public void configureKeyboardShortcutsInChrome() throws InterruptedException, AWTException {
        openChromeKeyboardShortcutsPage();
        setShortcutKeyInChrome("all tabs: - [title](url)", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "w");
        setShortcutKeyInChrome("all tabs: - [ ] [title](url)", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "e");
        setShortcutKeyInChrome("all tabs: - title", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "r");
        setShortcutKeyInChrome("all tabs: - url", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "t");
        setShortcutKeyInChrome("selected tabs: - [title](url)", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "y");
        setShortcutKeyInChrome("selected tabs: - [ ] [title](url)", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "u");
        setShortcutKeyInChrome("selected tabs: - title", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "i");
        setShortcutKeyInChrome("selected tabs: - url", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "o");
    }

    public void configureKeyboardShortcutsInFirefox() throws InterruptedException, AWTException {
        openFirefoxKeyboardShortcutsPage();
        setShortcutKeyInFirefox("all-tabs-link-as-list", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "w");
        setShortcutKeyInFirefox("all-tabs-link-as-task-list", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "e");
        setShortcutKeyInFirefox("all-tabs-title-as-list", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "r");
        setShortcutKeyInFirefox("all-tabs-url-as-list", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "t");
        setShortcutKeyInFirefox("highlighted-tabs-link-as-list", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "y");
        setShortcutKeyInFirefox("highlighted-tabs-link-as-task-list", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "u");
        setShortcutKeyInFirefox("highlighted-tabs-title-as-list", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "i");
        setShortcutKeyInFirefox("highlighted-tabs-url-as-list", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "o");
    }

    @BeforeMethod
    public void setUp() {
        grantPermission("tabs");
        grantPermission("tabGroups");
        openDemoTabs(true);
        driver.findElement(By.id("switch-to-demo")).click();
    }

    @AfterMethod
    public void teardown() {
        driver.switchTo().window(mainWindowHandle);
        driver.findElement(By.id("close-demo")).click();
    }

    @Test
    public void allTabsLink() throws AWTException, IOException, UnsupportedFlavorException, InterruptedException {
        runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_W);

        String expected = """
                    - [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                    - Group 1
                      - [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
                      - [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                    - [Page 3 - Copy as Markdown](http://localhost:5566/3.html)
                    - Untitled green group
                      - [Page 4 - Copy as Markdown](http://localhost:5566/4.html)
                    - [Page 5 - Copy as Markdown](http://localhost:5566/5.html)""";

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test
    public void allTabsTaskList() throws AWTException, IOException, UnsupportedFlavorException {
        runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_E);

        String expected = """
                    - [ ] [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                    - [ ] Group 1
                      - [ ] [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
                      - [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                    - [ ] [Page 3 - Copy as Markdown](http://localhost:5566/3.html)
                    - [ ] Untitled green group
                      - [ ] [Page 4 - Copy as Markdown](http://localhost:5566/4.html)
                    - [ ] [Page 5 - Copy as Markdown](http://localhost:5566/5.html)""";

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test
    public void allTabsTitle() throws AWTException, IOException, UnsupportedFlavorException {
        runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_R);

        String expected = """
                    - Page 0 - Copy as Markdown
                    - Group 1
                      - Page 1 - Copy as Markdown
                      - Page 2 - Copy as Markdown
                    - Page 3 - Copy as Markdown
                    - Untitled green group
                      - Page 4 - Copy as Markdown
                    - Page 5 - Copy as Markdown""";

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test
    public void allTabsUrl() throws AWTException, IOException, UnsupportedFlavorException {
        runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_T);

        String expected = """
                    - http://localhost:5566/0.html
                    - Group 1
                      - http://localhost:5566/1.html
                      - http://localhost:5566/2.html
                    - http://localhost:5566/3.html
                    - Untitled green group
                      - http://localhost:5566/4.html
                    - http://localhost:5566/5.html""";

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test
    public void highlightedTabsLink() throws AWTException, IOException, UnsupportedFlavorException, InterruptedException {
        runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_Y);

        String expected = """
                - [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - Group 1
                  - [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - Untitled green group
                  - [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""";

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test
    public void highlightedTabsTaskList() throws AWTException, IOException, UnsupportedFlavorException {
        runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_U);

        String expected = """
                - [ ] [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - [ ] Group 1
                  - [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [ ] Untitled green group
                  - [ ] [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""";

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test
    public void highlightedTabsTitle() throws AWTException, IOException, UnsupportedFlavorException {
        runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_I);

        String expected = """
                - Page 0 - Copy as Markdown
                - Group 1
                  - Page 2 - Copy as Markdown
                - Untitled green group
                  - Page 4 - Copy as Markdown""";

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test
    public void highlightedTabsUrl() throws AWTException, IOException, UnsupportedFlavorException {
        runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_O);

        String expected = """
                - http://localhost:5566/0.html
                - Group 1
                  - http://localhost:5566/2.html
                - Untitled green group
                  - http://localhost:5566/4.html""";

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }
}
