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

import static org.testng.Assert.assertEquals;

public class TabExportingWithGroupsTest extends BaseTest {
    @BeforeClass
    public void setUp() throws InterruptedException, AWTException {
        configureKeyboardShortcuts();
        grantPermission("tabs");
        grantPermission("tabGroups");
    }

    @AfterClass
    public void teardown() {
        driver.switchTo().window(mainWindowHandle);
        driver.findElement(By.id("close-demo")).click();
    }

    @Test(dataProvider = "indentationsAndListStyles")
    public void allTabsLink(String indentation, String listStyle) throws AWTException, IOException, UnsupportedFlavorException {
        setTabGroupIndentation(indentation);
        setListStyle(listStyle);
        openDemoTabs(true);
        driver.findElement(By.id("switch-to-demo")).click();
        CommandDescriptor cmd = getCommandDescriptor("all-tabs-link-as-list");
        runShortcutKeys(cmd.getRobotModifiers(), cmd.getRobotKey());

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
        expectedIndentation(indentation),expectedListStyle(listStyle));

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test(dataProvider = "indentations")
    public void allTabsTaskList(String indentation) throws AWTException, IOException, UnsupportedFlavorException {
        setTabGroupIndentation(indentation);
        openDemoTabs(true);
        driver.findElement(By.id("switch-to-demo")).click();
        CommandDescriptor cmd = getCommandDescriptor("all-tabs-link-as-task-list");
        runShortcutKeys(cmd.getRobotModifiers(), cmd.getRobotKey());

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

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test(dataProvider = "indentationsAndListStyles")
    public void allTabsTitle(String indentation, String listStyle) throws AWTException, IOException, UnsupportedFlavorException {
        setTabGroupIndentation(indentation);
        setListStyle(listStyle);
        openDemoTabs(true);
        driver.findElement(By.id("switch-to-demo")).click();
        CommandDescriptor cmd = getCommandDescriptor("all-tabs-title-as-list");
        runShortcutKeys(cmd.getRobotModifiers(), cmd.getRobotKey());

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
        expectedIndentation(indentation),expectedListStyle(listStyle));

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test(dataProvider = "indentationsAndListStyles")
    public void allTabsUrl(String indentation, String listStyle) throws AWTException, IOException, UnsupportedFlavorException {
        setTabGroupIndentation(indentation);
        setListStyle(listStyle);
        openDemoTabs(true);
        driver.findElement(By.id("switch-to-demo")).click();
        CommandDescriptor cmd = getCommandDescriptor("all-tabs-url-as-list");
        runShortcutKeys(cmd.getRobotModifiers(), cmd.getRobotKey());

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
        expectedIndentation(indentation),expectedListStyle(listStyle));

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test(dataProvider = "indentationsAndListStyles")
    public void highlightedTabsLink(String indentation, String listStyle) throws AWTException, IOException, UnsupportedFlavorException {
        setTabGroupIndentation(indentation);
        setListStyle(listStyle);
        openDemoTabs(true);
        driver.findElement(By.id("switch-to-demo")).click();
        CommandDescriptor cmd = getCommandDescriptor("highlighted-tabs-link-as-list");
        runShortcutKeys(cmd.getRobotModifiers(), cmd.getRobotKey());

        String expected = MessageFormat.format("""
                {1} [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                {1} Group 1
                {0}{1} [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                {1} Untitled green group
                {0}{1} [Page 5 - Copy as Markdown](http://localhost:5566/5.html)""",
                expectedIndentation(indentation),expectedListStyle(listStyle));

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test(dataProvider = "indentations")
    public void highlightedTabsTaskList(String indentation) throws AWTException, IOException, UnsupportedFlavorException {
        setTabGroupIndentation(indentation);
        openDemoTabs(true);
        driver.findElement(By.id("switch-to-demo")).click();
        CommandDescriptor cmd = getCommandDescriptor("highlighted-tabs-link-as-task-list");
        runShortcutKeys(cmd.getRobotModifiers(), cmd.getRobotKey());

        String expected = MessageFormat.format("""
                - [ ] [Page 0 - Copy as Markdown](http://localhost:5566/0.html)
                - [ ] Group 1
                {0}- [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
                - [ ] Untitled green group
                {0}- [ ] [Page 5 - Copy as Markdown](http://localhost:5566/5.html)""",
                expectedIndentation(indentation));

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test(dataProvider = "indentationsAndListStyles")
    public void highlightedTabsTitle(String indentation, String listStyle) throws AWTException, IOException, UnsupportedFlavorException {
        setTabGroupIndentation(indentation);
        setListStyle(listStyle);
        openDemoTabs(true);
        driver.findElement(By.id("switch-to-demo")).click();
        CommandDescriptor cmd = getCommandDescriptor("highlighted-tabs-title-as-list");
        runShortcutKeys(cmd.getRobotModifiers(), cmd.getRobotKey());

        String expected = MessageFormat.format("""
                {1} Page 0 - Copy as Markdown
                {1} Group 1
                {0}{1} Page 2 - Copy as Markdown
                {1} Untitled green group
                {0}{1} Page 5 - Copy as Markdown""",
                expectedIndentation(indentation),expectedListStyle(listStyle));

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test(dataProvider = "indentationsAndListStyles")
    public void highlightedTabsUrl(String indentation, String listStyle) throws AWTException, IOException, UnsupportedFlavorException {
        setTabGroupIndentation(indentation);
        setListStyle(listStyle);
        openDemoTabs(true);
        driver.findElement(By.id("switch-to-demo")).click();
        CommandDescriptor cmd = getCommandDescriptor("highlighted-tabs-url-as-list");
        runShortcutKeys(cmd.getRobotModifiers(), cmd.getRobotKey());

        String expected = MessageFormat.format("""
                {1} http://localhost:5566/0.html
                {1} Group 1
                {0}{1} http://localhost:5566/2.html
                {1} Untitled green group
                {0}{1} http://localhost:5566/5.html""",
                expectedIndentation(indentation),expectedListStyle(listStyle));

        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }
}
