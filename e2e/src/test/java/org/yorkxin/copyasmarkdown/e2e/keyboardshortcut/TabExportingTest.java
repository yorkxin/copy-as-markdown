package org.yorkxin.copyasmarkdown.e2e.keyboardshortcut;

import org.openqa.selenium.By;
import org.openqa.selenium.Keys;
import org.openqa.selenium.WebElement;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.awt.*;
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.awt.event.KeyEvent;
import java.io.IOException;

import static org.testng.Assert.*;

public class TabExportingTest extends BaseTest {
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
        openDemoTabs(false);
        driver.findElement(By.id("switch-to-demo")).click();
    }

    @AfterMethod
    public void teardown() {
        driver.switchTo().window(mainWindowHandle);
        driver.findElement(By.id("close-demo")).click();
    }

    private void testNoPermission(int[] modifiers, int key) throws AWTException {
        // test that pressing keyboard shortcuts opens options page with error message,
        // if tabs is not enabled
        removePermission("tabs");
        openDemoTabs(false);
        driver.findElement(By.id("switch-to-demo")).click();

        java.util.Set<String> windowsBefore = driver.getWindowHandles();
        // smash the shortcut keys
        runShortcutKeys(modifiers, key);

        // assert that it opens one window, which is the permissions dialog
        java.util.Set<String> windowsAfter = driver.getWindowHandles();
        windowsAfter.removeAll(windowsBefore);
        assertEquals(1, windowsAfter.size());
        driver.switchTo().window(windowsAfter.iterator().next());
        assertEquals(driver.getCurrentUrl(), getExtensionProtocol()+"://"+extId+"/dist/ui/permissions.html?permissions=tabs");
    }

    @Test
    public void allTabsLink() throws AWTException, IOException, UnsupportedFlavorException, InterruptedException {
        int[] modifiers = new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT};
        int key = KeyEvent.VK_W;
        runShortcutKeys(modifiers, key);

        String expected = """
                  - [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                  - [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
                  - [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                  - [Page 3 - Copy as Markdown](http://localhost:5566/3.html)
                  - [Page 4 - Copy as Markdown](http://localhost:5566/4.html)
                  - [Page 5 - Copy as Markdown](http://localhost:5566/5.html)""";

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));

        testNoPermission(modifiers,key);
    }

    @Test
    public void allTabsTaskList() throws AWTException, IOException, UnsupportedFlavorException {
        int[] modifiers = new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT};
        int key = KeyEvent.VK_E;
        runShortcutKeys(modifiers, key);

        String expected = """
                  - [ ] [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                  - [ ] [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
                  - [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                  - [ ] [Page 3 - Copy as Markdown](http://localhost:5566/3.html)
                  - [ ] [Page 4 - Copy as Markdown](http://localhost:5566/4.html)
                  - [ ] [Page 5 - Copy as Markdown](http://localhost:5566/5.html)""";

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));

        testNoPermission(modifiers,key);
    }

    @Test
    public void allTabsTitle() throws AWTException, IOException, UnsupportedFlavorException {
        int[] modifiers = new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT};
        int key = KeyEvent.VK_R;
        runShortcutKeys(modifiers, key);

        String expected = """
                  - Page 0 - Copy as Markdown
                  - Page 1 - Copy as Markdown
                  - Page 2 - Copy as Markdown
                  - Page 3 - Copy as Markdown
                  - Page 4 - Copy as Markdown
                  - Page 5 - Copy as Markdown""";

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));

        testNoPermission(modifiers,key);
    }

    @Test
    public void allTabsUrl() throws AWTException, IOException, UnsupportedFlavorException {
        int[] modifiers = new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT};
        int key = KeyEvent.VK_T;
        runShortcutKeys(modifiers, key);

        String expected = """
                  - http://localhost:5566/0.html
                  - http://localhost:5566/1.html
                  - http://localhost:5566/2.html
                  - http://localhost:5566/3.html
                  - http://localhost:5566/4.html
                  - http://localhost:5566/5.html""";

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));

        testNoPermission(modifiers,key);
    }

    @Test
    public void highlightedTabsLink() throws AWTException, IOException, UnsupportedFlavorException, InterruptedException {
        int[] modifiers = new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT};
        int key = KeyEvent.VK_Y;
        runShortcutKeys(modifiers, key);

        String expected = """
                - [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""";

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));

        testNoPermission(modifiers,key);
    }

    @Test
    public void highlightedTabsTaskList() throws AWTException, IOException, UnsupportedFlavorException {
        int[] modifiers = new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT};
        int key = KeyEvent.VK_U;
        runShortcutKeys(modifiers, key);

        String expected = """
                - [ ] [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [ ] [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""";

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));

        testNoPermission(modifiers,key);
    }

    @Test
    public void highlightedTabsTitle() throws AWTException, IOException, UnsupportedFlavorException {
        int[] modifiers = new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT};
        int key = KeyEvent.VK_I;
        runShortcutKeys(modifiers, key);

        String expected = """
                - Page 0 - Copy as Markdown
                - Page 2 - Copy as Markdown
                - Page 4 - Copy as Markdown""";

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));

        testNoPermission(modifiers,key);
    }

    @Test
    public void highlightedTabsUrl() throws AWTException, IOException, UnsupportedFlavorException {
        int[] modifiers = new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT};
                int key = KeyEvent.VK_O;
                runShortcutKeys(modifiers, key);

        String expected = """
                - http://localhost:5566/0.html
                - http://localhost:5566/2.html
                - http://localhost:5566/4.html""";

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));

        testNoPermission(modifiers,key);
    }
}
