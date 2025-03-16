package org.yorkxin.copyasmarkdown.e2e;

import org.openqa.selenium.*;
import org.openqa.selenium.interactions.Actions;
import org.testng.annotations.*;
import static org.testng.Assert.*;

import java.awt.*;
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.awt.event.KeyEvent;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.Path;
import java.util.Objects;

public class ContextMenuTest extends BaseTest {
    @BeforeMethod
    public void goToQaPage() {
        driver.get("http://localhost:5566/qa.html");
    }

    @Test
    public void currentTabLink() throws AWTException, InterruptedException, IOException, UnsupportedFlavorException {
        Actions actions = new Actions(driver);
        WebElement emptySpace = driver.findElement(By.id("empty-space"));
        actions.moveToElement(emptySpace).contextClick(emptySpace).perform();
        Robot robot = new Robot();
        robot.waitForIdle();
        robot.setAutoDelay(50); // type faster to avoid selecting built-in menu item
        robot.keyPress(KeyEvent.VK_C);
        robot.keyPress(KeyEvent.VK_O);
        robot.keyPress(KeyEvent.VK_P);
        robot.keyPress(KeyEvent.VK_Y);
        robot.keyPress(KeyEvent.VK_SPACE);
        robot.keyPress(KeyEvent.VK_P);
        robot.keyPress(KeyEvent.VK_A);
        robot.keyPress(KeyEvent.VK_G);
        robot.keyPress(KeyEvent.VK_E);
        robot.keyPress(KeyEvent.VK_ENTER);
        Thread.sleep(500);
        String expected = "[[QA] \\*\\*Hello\\*\\* \\_World\\_](http://localhost:5566/qa.html)";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test
    public void onPageLink() throws AWTException, InterruptedException, IOException, UnsupportedFlavorException {
        Actions actions = new Actions(driver);
        WebElement link = driver.findElement(By.id("link-1"));
        actions.moveToElement(link).contextClick(link).perform();
        Robot robot = new Robot();
        robot.waitForIdle();
        robot.setAutoDelay(50); // type faster to avoid selecting built-in menu item
        if (Objects.equals(browser, BROWSER_CHROME) && Platform.getCurrent().is(Platform.MAC)) {
            // Folded on Chrome+macOS, not folded on Firefox+macOS.
            // Because on macOS using the built-in layout engine, when you select a link, the text will also be
            // selected, so there will be two menu items: Copy Link as Markdown, and Copy Selection as Markdown.
            // On Firefox the text won't be selected, so there will be only one menu item.
            //
            // TODO: behavior unknown on Windows / Linux GTK / Linux KDE
            enterSubMenu(robot);
        }
        robot.keyPress(KeyEvent.VK_C);
        robot.keyPress(KeyEvent.VK_O);
        robot.keyPress(KeyEvent.VK_P);
        robot.keyPress(KeyEvent.VK_Y);
        robot.keyPress(KeyEvent.VK_SPACE);
        robot.keyPress(KeyEvent.VK_L);
        robot.keyPress(KeyEvent.VK_I);
        robot.keyPress(KeyEvent.VK_N);
        robot.keyPress(KeyEvent.VK_K);
        robot.keyPress(KeyEvent.VK_SPACE);
        robot.keyPress(KeyEvent.VK_A);
        robot.keyPress(KeyEvent.VK_S);
        robot.keyPress(KeyEvent.VK_SPACE);
        robot.keyPress(KeyEvent.VK_M);
        robot.keyPress(KeyEvent.VK_A);
        robot.keyPress(KeyEvent.VK_R);
        robot.keyPress(KeyEvent.VK_K);
        robot.keyPress(KeyEvent.VK_D);
        robot.keyPress(KeyEvent.VK_O);
        robot.keyPress(KeyEvent.VK_W);
        robot.keyPress(KeyEvent.VK_N);
        robot.keyPress(KeyEvent.VK_ENTER);
        Thread.sleep(500);
        String expected = "[[APOLLO-13] Build A Rocket Engine](about:blank)";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test
    public void onPageImage() throws AWTException, InterruptedException, IOException, UnsupportedFlavorException {
        Actions actions = new Actions(driver);
        WebElement link = driver.findElement(By.id("img-1"));
        actions.moveToElement(link).contextClick(link).perform();
        Robot robot = new Robot();
        robot.waitForIdle();
        robot.setAutoDelay(50); // type faster to avoid selecting built-in menu item
        robot.keyPress(KeyEvent.VK_C);
        robot.keyPress(KeyEvent.VK_O);
        robot.keyPress(KeyEvent.VK_P);
        robot.keyPress(KeyEvent.VK_Y);
        robot.keyPress(KeyEvent.VK_SPACE);
        robot.keyPress(KeyEvent.VK_I);
        robot.keyPress(KeyEvent.VK_M);
        robot.keyPress(KeyEvent.VK_A);
        robot.keyPress(KeyEvent.VK_G);
        robot.keyPress(KeyEvent.VK_E);
        robot.keyPress(KeyEvent.VK_SPACE);
        robot.keyPress(KeyEvent.VK_A);
        robot.keyPress(KeyEvent.VK_S);
        robot.keyPress(KeyEvent.VK_SPACE);
        robot.keyPress(KeyEvent.VK_M);
        robot.keyPress(KeyEvent.VK_A);
        robot.keyPress(KeyEvent.VK_R);
        robot.keyPress(KeyEvent.VK_K);
        robot.keyPress(KeyEvent.VK_D);
        robot.keyPress(KeyEvent.VK_O);
        robot.keyPress(KeyEvent.VK_W);
        robot.keyPress(KeyEvent.VK_N);
        robot.keyPress(KeyEvent.VK_ENTER);
        Thread.sleep(500);
        String expected = "![](http://localhost:5566/icon.png)";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test
    public void onPageImageInLink() throws AWTException, InterruptedException, IOException, UnsupportedFlavorException {
        Actions actions = new Actions(driver);
        WebElement link = driver.findElement(By.id("img-2"));
        actions.moveToElement(link).contextClick(link).perform();
        Robot robot = new Robot();
        robot.waitForIdle();
        robot.setAutoDelay(50); // type faster to avoid selecting built-in menu item
        enterSubMenu(robot);
        robot.keyPress(KeyEvent.VK_C);
        robot.keyPress(KeyEvent.VK_O);
        robot.keyPress(KeyEvent.VK_P);
        robot.keyPress(KeyEvent.VK_Y);
        robot.keyPress(KeyEvent.VK_SPACE);
        robot.keyPress(KeyEvent.VK_L);
        robot.keyPress(KeyEvent.VK_I);
        robot.keyPress(KeyEvent.VK_N);
        robot.keyPress(KeyEvent.VK_K);
        robot.keyPress(KeyEvent.VK_A);
        robot.keyPress(KeyEvent.VK_S);
        robot.keyPress(KeyEvent.VK_SPACE);
        robot.keyPress(KeyEvent.VK_M);
        robot.keyPress(KeyEvent.VK_A);
        robot.keyPress(KeyEvent.VK_R);
        robot.keyPress(KeyEvent.VK_K);
        robot.keyPress(KeyEvent.VK_D);
        robot.keyPress(KeyEvent.VK_O);
        robot.keyPress(KeyEvent.VK_W);
        robot.keyPress(KeyEvent.VK_N);
        robot.keyPress(KeyEvent.VK_ENTER);
        Thread.sleep(500);
        String expected = "[![](http://localhost:5566/icon.png)](about:blank)";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test
    public void onPageSelection() throws AWTException, InterruptedException, IOException, UnsupportedFlavorException {
        Path filePath = Paths.get("support/pages/selection.md");
        String expected = Files.readString(filePath);

        // navigate to selection.html
        driver.findElement(By.id("go-to-selection")).click();
        selectAll();
        WebElement body = driver.findElement(By.tagName("body"));
        Actions actions = new Actions(driver);
        actions.contextClick(body).perform();

        Robot robot = new Robot();
        robot.waitForIdle();
        robot.setAutoDelay(50); // type faster to avoid selecting built-in menu item
        robot.keyPress(KeyEvent.VK_C);
        robot.keyPress(KeyEvent.VK_O);
        robot.keyPress(KeyEvent.VK_P);
        robot.keyPress(KeyEvent.VK_Y);
        robot.keyPress(KeyEvent.VK_SPACE);
        robot.keyPress(KeyEvent.VK_S);
        robot.keyPress(KeyEvent.VK_E);
        robot.keyPress(KeyEvent.VK_L);
        robot.keyPress(KeyEvent.VK_E);
        robot.keyPress(KeyEvent.VK_C);
        robot.keyPress(KeyEvent.VK_T);
        robot.keyPress(KeyEvent.VK_I);
        robot.keyPress(KeyEvent.VK_O);
        robot.keyPress(KeyEvent.VK_N);
        robot.keyPress(KeyEvent.VK_SPACE);
        robot.keyPress(KeyEvent.VK_A);
        robot.keyPress(KeyEvent.VK_S);
        robot.keyPress(KeyEvent.VK_SPACE);
        robot.keyPress(KeyEvent.VK_M);
        robot.keyPress(KeyEvent.VK_A);
        robot.keyPress(KeyEvent.VK_R);
        robot.keyPress(KeyEvent.VK_K);
        robot.keyPress(KeyEvent.VK_D);
        robot.keyPress(KeyEvent.VK_O);
        robot.keyPress(KeyEvent.VK_W);
        robot.keyPress(KeyEvent.VK_N);
        robot.keyPress(KeyEvent.VK_ENTER);
        Thread.sleep(500);
        // NOTE: in the selection.md file, there is a line with only four space chars right below a code block.
        // This is expected and is part of the test case, because the original <pre><code> is ended with a new line.
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    // In Chrome, context menu items more than 1 will be folded in a sub menu with extension's name.
    // This macro tries to enter the sub menu by typing the full name of the extension.
    private static void enterSubMenu(Robot robot) {
        robot.keyPress(KeyEvent.VK_C);
        robot.keyPress(KeyEvent.VK_O);
        robot.keyPress(KeyEvent.VK_P);
        robot.keyPress(KeyEvent.VK_Y);
        robot.keyPress(KeyEvent.VK_SPACE);
        robot.keyPress(KeyEvent.VK_A);
        robot.keyPress(KeyEvent.VK_S);
        robot.keyPress(KeyEvent.VK_SPACE);
        robot.keyPress(KeyEvent.VK_M);
        robot.keyPress(KeyEvent.VK_A);
        robot.keyPress(KeyEvent.VK_R);
        robot.keyPress(KeyEvent.VK_K);
        robot.keyPress(KeyEvent.VK_D);
        robot.keyPress(KeyEvent.VK_O);
        robot.keyPress(KeyEvent.VK_W);
        robot.keyPress(KeyEvent.VK_N);
        robot.keyPress(KeyEvent.VK_RIGHT);
    }
}
