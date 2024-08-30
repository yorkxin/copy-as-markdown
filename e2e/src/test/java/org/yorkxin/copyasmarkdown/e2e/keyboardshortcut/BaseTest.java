package org.yorkxin.copyasmarkdown.e2e.keyboardshortcut;

import io.github.sukgu.Shadow;
import org.openqa.selenium.*;
import org.openqa.selenium.interactions.Actions;
import org.testng.annotations.*;

import static org.testng.Assert.*;

import java.awt.*;
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.awt.event.KeyEvent;
import java.io.IOException;
import java.util.List;
import java.util.Objects;

public class BaseTest extends org.yorkxin.copyasmarkdown.e2e.BaseTest {
    protected void openChromeKeyboardShortcutsPage() {
        driver.switchTo().newWindow(WindowType.WINDOW).get("chrome://extensions/shortcuts");
    }

    protected void openFirefoxKeyboardShortcutsPage() {
        driver.switchTo().newWindow(WindowType.WINDOW).get("about:addons");
        driver.findElement(By.cssSelector("button[action='page-options']")).click();

        // Choose the last item on the menu which opens the keyboard shortcuts options.

        Actions actions = new Actions(driver);
        actions.keyDown(Keys.DOWN)
                .keyDown(Keys.DOWN)
                .keyDown(Keys.DOWN)
                .keyDown(Keys.DOWN)
                .keyDown(Keys.DOWN)
                .keyDown(Keys.DOWN)
                .keyDown(Keys.DOWN)
                .keyDown(Keys.ENTER)
                .perform();

        driver.findElements(By.cssSelector("button[data-l10n-id=\"shortcuts-card-expand-button\"]")).forEach(e -> e.click());
    }

    protected static void runShortcutKeys(int[] modifiers, int key) throws AWTException {
        Robot robot = new Robot();
        for (int modifier : modifiers) {
            robot.keyPress(modifier);
            robot.delay(200);
        }
        robot.keyPress(key);
        for (int modifier : modifiers) {
            robot.keyRelease(modifier);
        }
        robot.delay(500);
    }

    protected void setShortcutKeyInChrome(CommandDescriptor cmd) throws AWTException, InterruptedException {
        // Max 4 shortcut keys can be specified in the manifest.json file,
        // so we have to navigate to chrome://extension/shortcuts and configure them in runtime.

        if (!Objects.equals(driver.getCurrentUrl(), "chrome://extensions/shortcuts")) {
            throw new InvalidArgumentException("this function only works in chrome://extensions/shortcuts page");
        }
        Shadow shadow = new Shadow(driver);
        List<WebElement> commandEntries = shadow.findElements("div.command-entry");

        WebElement cmdEntry = null;
        for (WebElement entry : commandEntries) {
            String name = entry.findElement(By.className("command-name")).getText() ;
            if (Objects.equals(name, cmd.name)){
                cmdEntry = entry;
                break;
            }
        }

        if (cmdEntry == null) {
            throw new IllegalArgumentException("no such command: "+cmd.name);
        }

        WebElement editButton = shadow.findElement(cmdEntry, "#edit");
        WebElement inputBox = shadow.findElement(cmdEntry, "#input");

        // NOTE: for some reason, Robot does not work here, so using Actions to trigger DOM key events.

        Actions actions = new Actions(driver);
        actions.scrollToElement(editButton)
                .click(editButton)
                .click(inputBox);

        for (CharSequence modifier : cmd.modifiers) {
            actions = actions.keyDown(modifier);
        }
        actions.keyDown(cmd.key);
        for (CharSequence modifier : cmd.modifiers) {
            actions = actions.keyUp(modifier);
        }
        actions.perform();
    }

    protected void setShortcutKeyInFirefox(CommandDescriptor cmd) throws AWTException {
        WebElement cmdEntry = driver.findElement(By.xpath("//input[@name=\""+cmd.command+"\"]"));

        if (cmdEntry == null) {
            throw new IllegalArgumentException("no such command: "+cmd.command);
        }

        if (!cmdEntry.isDisplayed()) {
            driver.findElement(By.className("expand-button")).click();
        }

        // https://stackoverflow.com/a/63420553
        ((JavascriptExecutor) driver).executeScript("arguments[0].scrollIntoView(false);", cmdEntry);

        new Actions(driver).scrollToElement(cmdEntry).click(cmdEntry).perform();

        Actions actions = new Actions(driver);
        for (CharSequence modifier : cmd.modifiers) {
            actions = actions.keyDown(modifier);
        }
        actions.keyDown(cmd.key);
        for (CharSequence modifier : cmd.modifiers) {
            actions = actions.keyUp(modifier);
        }
        actions.perform();
    }
}
