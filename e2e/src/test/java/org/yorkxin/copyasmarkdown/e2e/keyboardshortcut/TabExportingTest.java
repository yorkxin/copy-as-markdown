package org.yorkxin.copyasmarkdown.e2e.keyboardshortcut;

import org.openqa.selenium.By;
import org.openqa.selenium.Keys;
import org.testng.annotations.*;

import java.awt.*;
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.awt.event.KeyEvent;
import java.io.IOException;
import java.text.MessageFormat;

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

    public static CommandDescriptor[] allCommandDescriptors() {
        return new CommandDescriptor[]{
                new CommandDescriptor("all tabs: - [title](url)", "all-tabs-link-as-list", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "w"),
                new CommandDescriptor("all tabs: - [ ] [title](url)", "all-tabs-link-as-task-list", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "e"),
                new CommandDescriptor("all tabs: - title", "all-tabs-title-as-list", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "r"),
                new CommandDescriptor("all tabs: - url", "all-tabs-url-as-list", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "t"),
                new CommandDescriptor("selected tabs: - [title](url)", "highlighted-tabs-link-as-list", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "y"),
                new CommandDescriptor("selected tabs: - [ ] [title](url)", "highlighted-tabs-link-as-task-list", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "u"),
                new CommandDescriptor("selected tabs: - title", "highlighted-tabs-title-as-list", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "i"),
                new CommandDescriptor("selected tabs: - url", "highlighted-tabs-url-as-list", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "o"),
        };
    }

    @DataProvider(name = "allCommands")
    public static Object[][] allCommands() {
        CommandDescriptor[] cds = allCommandDescriptors();
        Object[][] ret = new Object[cds.length][];
        for (int i = 0; i < cds.length; i++) {
            ret[i] = new Object[]{cds[i].command, cds[i].getRobotModifiers(), cds[i].getRobotKey()};
        }
        return ret;
    }

    public void configureKeyboardShortcutsInChrome() throws InterruptedException, AWTException {
        openChromeKeyboardShortcutsPage();
        for (CommandDescriptor cmd : allCommandDescriptors()) {
            setShortcutKeyInChrome(cmd.name, cmd.modifiers, cmd.key);
        }
    }

    public void configureKeyboardShortcutsInFirefox() throws InterruptedException, AWTException {
        openFirefoxKeyboardShortcutsPage();
        for (CommandDescriptor cmd : allCommandDescriptors()) {
            setShortcutKeyInFirefox(cmd.command, cmd.modifiers, cmd.key);
        }
    }

    @BeforeMethod
    public void setUp() {
        grantPermission("tabs");
    }

    @AfterMethod
    public void teardown() {
        driver.switchTo().window(mainWindowHandle);
        driver.findElement(By.id("close-demo")).click();
    }


    @Test(dataProvider = "allCommands")
    public void testNoPermission(String cmd /* for test legibility */, int[] modifiers, int key) throws AWTException {
        // test that pressing keyboard shortcuts opens permissions dialog
        // if tabs permission is not enabled
        removePermission("tabs");

        // smash the shortcut keys
        openDemoTabs(false);
        driver.findElement(By.id("switch-to-demo")).click();
        java.util.Set<String> windowsBefore = driver.getWindowHandles();
        runShortcutKeys(modifiers, key);

        // assert that it opens one window, which is the permissions dialog
        java.util.Set<String> windowsAfter = driver.getWindowHandles();
        windowsAfter.removeAll(windowsBefore);
        assertEquals(windowsAfter.size(), 1);
        driver.switchTo().window(windowsAfter.iterator().next());
        assertEquals(driver.getCurrentUrl(), getExtensionProtocol()+"://"+extId+"/dist/ui/permissions.html?permissions=tabs");
    }

    @Test(dataProvider = "listStyles")
    public void allTabsLink(String listStyle) throws AWTException, IOException, UnsupportedFlavorException, InterruptedException {
        setListStyle(listStyle);
        int[] modifiers = new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT};
        int key = KeyEvent.VK_W;
        openDemoTabs(false);
        driver.findElement(By.id("switch-to-demo")).click();
        runShortcutKeys(modifiers, key);

        String expected = MessageFormat.format("""
                  {0} [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                  {0} [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
                  {0} [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                  {0} [Page 3 - Copy as Markdown](http://localhost:5566/3.html)
                  {0} [Page 4 - Copy as Markdown](http://localhost:5566/4.html)
                  {0} [Page 5 - Copy as Markdown](http://localhost:5566/5.html)""",
                expectedListStyle(listStyle));

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test
    public void allTabsTaskList() throws AWTException, IOException, UnsupportedFlavorException {
        int[] modifiers = new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT};
        int key = KeyEvent.VK_E;
        openDemoTabs(false);
        driver.findElement(By.id("switch-to-demo")).click();
        runShortcutKeys(modifiers, key);

        String expected = """
                  - [ ] [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                  - [ ] [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
                  - [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                  - [ ] [Page 3 - Copy as Markdown](http://localhost:5566/3.html)
                  - [ ] [Page 4 - Copy as Markdown](http://localhost:5566/4.html)
                  - [ ] [Page 5 - Copy as Markdown](http://localhost:5566/5.html)""";

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test(dataProvider = "listStyles")
    public void allTabsTitle(String listStyle) throws AWTException, IOException, UnsupportedFlavorException {
        setListStyle(listStyle);
        int[] modifiers = new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT};
        int key = KeyEvent.VK_R;
        openDemoTabs(false);
        driver.findElement(By.id("switch-to-demo")).click();
        runShortcutKeys(modifiers, key);

        String expected = MessageFormat.format("""
                  {0} Page 0 - Copy as Markdown
                  {0} Page 1 - Copy as Markdown
                  {0} Page 2 - Copy as Markdown
                  {0} Page 3 - Copy as Markdown
                  {0} Page 4 - Copy as Markdown
                  {0} Page 5 - Copy as Markdown""",
                expectedListStyle(listStyle));

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test(dataProvider = "listStyles")
    public void allTabsUrl(String listStyle) throws AWTException, IOException, UnsupportedFlavorException {
        setListStyle(listStyle);
        int[] modifiers = new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT};
        int key = KeyEvent.VK_T;
        openDemoTabs(false);
        driver.findElement(By.id("switch-to-demo")).click();
        runShortcutKeys(modifiers, key);

        String expected = MessageFormat.format("""
                  {0} http://localhost:5566/0.html
                  {0} http://localhost:5566/1.html
                  {0} http://localhost:5566/2.html
                  {0} http://localhost:5566/3.html
                  {0} http://localhost:5566/4.html
                  {0} http://localhost:5566/5.html""",
                expectedListStyle(listStyle));

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test(dataProvider = "listStyles")
    public void highlightedTabsLink(String listStyle) throws AWTException, IOException, UnsupportedFlavorException, InterruptedException {
        setListStyle(listStyle);
        int[] modifiers = new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT};
        int key = KeyEvent.VK_Y;
        openDemoTabs(false);
        driver.findElement(By.id("switch-to-demo")).click();
        runShortcutKeys(modifiers, key);

        String expected = MessageFormat.format("""
                {0} [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                {0} [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                {0} [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""",
                expectedListStyle(listStyle));

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test
    public void highlightedTabsTaskList() throws AWTException, IOException, UnsupportedFlavorException {
        int[] modifiers = new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT};
        int key = KeyEvent.VK_U;
        openDemoTabs(false);
        driver.findElement(By.id("switch-to-demo")).click();
        runShortcutKeys(modifiers, key);

        String expected = """
                - [ ] [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [ ] [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""";

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test(dataProvider = "listStyles")
    public void highlightedTabsTitle(String listStyle) throws AWTException, IOException, UnsupportedFlavorException {
        setListStyle(listStyle);
        int[] modifiers = new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT};
        int key = KeyEvent.VK_I;
        openDemoTabs(false);
        driver.findElement(By.id("switch-to-demo")).click();
                runShortcutKeys(modifiers, key);

        String expected = MessageFormat.format("""
                {0} Page 0 - Copy as Markdown
                {0} Page 2 - Copy as Markdown
                {0} Page 4 - Copy as Markdown""",
                expectedListStyle(listStyle));

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test(dataProvider = "listStyles")
    public void highlightedTabsUrl(String listStyle) throws AWTException, IOException, UnsupportedFlavorException {
        setListStyle(listStyle);
        int[] modifiers = new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT};
                int key = KeyEvent.VK_O;
                openDemoTabs(false);
        driver.findElement(By.id("switch-to-demo")).click();
        runShortcutKeys(modifiers, key);

        String expected = MessageFormat.format("""
                {0} http://localhost:5566/0.html
                {0} http://localhost:5566/2.html
                {0} http://localhost:5566/4.html""",
                expectedListStyle(listStyle));

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }
}
