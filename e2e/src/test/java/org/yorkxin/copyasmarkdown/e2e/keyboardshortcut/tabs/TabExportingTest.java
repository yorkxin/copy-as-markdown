package org.yorkxin.copyasmarkdown.e2e.keyboardshortcut.tabs;

import org.openqa.selenium.By;
import org.testng.annotations.*;
import org.yorkxin.copyasmarkdown.e2e.keyboardshortcut.CommandDescriptor;

import java.awt.*;
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.awt.event.KeyEvent;
import java.io.IOException;
import java.text.MessageFormat;

import static org.testng.Assert.*;

public class TabExportingTest extends BaseTest {
    @BeforeClass
    public void setUp() throws InterruptedException, AWTException {
        configureKeyboardShortcuts();
        grantPermission("tabs");
    }

    @AfterClass
    public void teardown() {
        driver.switchTo().window(mainWindowHandle);
        driver.findElement(By.id("close-demo")).click();
    }

    @Test(dataProvider = "listStyles")
    public void allTabsLink(String listStyle) throws AWTException, IOException, UnsupportedFlavorException, InterruptedException {
        setListStyle(listStyle);
        openDemoTabs(false);
        driver.findElement(By.id("switch-to-demo")).click();
        CommandDescriptor cmd = getCommandDescriptor("all-tabs-link-as-list");
        runShortcutKeys(cmd.getRobotModifiers(), cmd.getRobotKey());

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
        openDemoTabs(false);
        driver.findElement(By.id("switch-to-demo")).click();
        CommandDescriptor cmd = getCommandDescriptor("all-tabs-link-as-task-list");
        runShortcutKeys(cmd.getRobotModifiers(), cmd.getRobotKey());

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
        openDemoTabs(false);
        driver.findElement(By.id("switch-to-demo")).click();
        CommandDescriptor cmd = getCommandDescriptor("all-tabs-title-as-list");
        runShortcutKeys(cmd.getRobotModifiers(), cmd.getRobotKey());

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
        openDemoTabs(false);
        driver.findElement(By.id("switch-to-demo")).click();
        CommandDescriptor cmd = getCommandDescriptor("all-tabs-url-as-list");
        runShortcutKeys(cmd.getRobotModifiers(), cmd.getRobotKey());

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
        openDemoTabs(false);
        driver.findElement(By.id("switch-to-demo")).click();
        CommandDescriptor cmd = getCommandDescriptor("highlighted-tabs-link-as-list");
        runShortcutKeys(cmd.getRobotModifiers(), cmd.getRobotKey());

        String expected = MessageFormat.format("""
                {0} [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                {0} [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                {0} [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""",
                expectedListStyle(listStyle));

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test
    public void highlightedTabsTaskList() throws AWTException, IOException, UnsupportedFlavorException {
        openDemoTabs(false);
        driver.findElement(By.id("switch-to-demo")).click();
        CommandDescriptor cmd = getCommandDescriptor("highlighted-tabs-link-as-task-list");
        runShortcutKeys(cmd.getRobotModifiers(), cmd.getRobotKey());

        String expected = """
                - [ ] [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [ ] [Page 4 - Copy as Markdown](http://localhost:5566/4.html)""";

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test(dataProvider = "listStyles")
    public void highlightedTabsTitle(String listStyle) throws AWTException, IOException, UnsupportedFlavorException {
        setListStyle(listStyle);
        openDemoTabs(false);
        driver.findElement(By.id("switch-to-demo")).click();
        CommandDescriptor cmd = getCommandDescriptor("highlighted-tabs-title-as-list");
        runShortcutKeys(cmd.getRobotModifiers(), cmd.getRobotKey());

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
        openDemoTabs(false);
        driver.findElement(By.id("switch-to-demo")).click();
        CommandDescriptor cmd = getCommandDescriptor("highlighted-tabs-url-as-list");
        runShortcutKeys(cmd.getRobotModifiers(), cmd.getRobotKey());

        String expected = MessageFormat.format("""
                {0} http://localhost:5566/0.html
                {0} http://localhost:5566/2.html
                {0} http://localhost:5566/4.html""",
                expectedListStyle(listStyle));

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }
}
