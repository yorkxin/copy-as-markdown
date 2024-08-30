package org.yorkxin.copyasmarkdown.e2e.keyboardshortcut.tabs;

import org.openqa.selenium.By;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;
import org.yorkxin.copyasmarkdown.e2e.keyboardshortcut.CommandDescriptor;

import java.awt.*;
import java.util.Objects;

import static org.testng.Assert.assertEquals;

public class NoPermissionTest extends BaseTest {
    @BeforeClass
    public void setUp() throws AWTException, InterruptedException {
        configureKeyboardShortcuts();
        // test that pressing keyboard shortcuts opens permissions dialog
        // if tabs permission is not enabled
        removeAllPermissions();
        openDemoTabs(false);
    }

    @Test(dataProvider = "allCommands")
    public void testNoPermission(String command) throws AWTException {
        if (Objects.equals(command, "selection-as-markdown") || Objects.equals(command, "current-tab-link") ) {
            // these command will not be blocked by permission
            return;
        }
        CommandDescriptor commandDescriptor = getCommandDescriptor(command);
        driver.switchTo().window(mainWindowHandle);
        driver.findElement(By.id("switch-to-demo")).click();
        java.util.Set<String> windowsBefore = driver.getWindowHandles();
        // smash the shortcut keys
        runShortcutKeys(commandDescriptor.getRobotModifiers(), commandDescriptor.getRobotKey());

        // assert that it opens one window, which is the permissions dialog
        java.util.Set<String> windowsAfter = driver.getWindowHandles();
        windowsAfter.removeAll(windowsBefore);
        assertEquals(windowsAfter.size(), 1);
        driver.switchTo().window(windowsAfter.iterator().next());
        assertEquals(driver.getCurrentUrl(), getExtensionProtocol()+"://"+extId+"/dist/ui/permissions.html?permissions=tabs");

        driver.close();
    }

}
