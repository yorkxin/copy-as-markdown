package org.yorkxin.copyasmarkdown.e2e;

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

public class KeyboardShortcutTest extends BaseTest {
    @BeforeClass
    public void setUp() throws IOException, InterruptedException, AWTException {
        super.setUp();

        driver.switchTo().newWindow(WindowType.WINDOW).get("chrome://extensions/shortcuts");
        configureShortcutKey("current tab: [title](url)", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "1");
        configureShortcutKey("all tabs: - [title](url)", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "2");
        configureShortcutKey("all tabs: - [ ] [title](url)", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "3");
        configureShortcutKey("all tabs: - title", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "4");
        configureShortcutKey("all tabs: - url", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "5");
        configureShortcutKey("selected tabs: - [title](url)", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "6");
        configureShortcutKey("selected tabs: - [ ] [title](url)", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "7");
        configureShortcutKey("selected tabs: - title", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "8");
        configureShortcutKey("selected tabs: - url", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "9");
        configureShortcutKey("Copy Selection as Markdown", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "q");
    }

    @Test
    public void currentTabLink() throws AWTException, IOException, UnsupportedFlavorException {
        driver.get("http://localhost:5566/qa.html");
        runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_1);

        String expected = "[[QA] \\*\\*Hello\\*\\* \\_World\\_](http://localhost:5566/qa.html)";
        assertEquals(expected,clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test
    public void copySelectionAsMarkdown () throws AWTException, IOException, UnsupportedFlavorException, InterruptedException {
        driver.get("http://localhost:5566/selection.html");
        selectAll();

        runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_Q);
        Thread.sleep(1000);

        String expected = """
                # Test: Selection
                                
                ## Header 2
                                
                ### Header 3
                                
                #### Header 4
                                
                ##### Header 5
                                
                ###### Header 6
                                
                Lorem _ipsum_ **dolor sit** _amet_ **consectetur** **_adipisicing_** [elit](https://example.com/). `Corrupti fugit` officia ![ICON](http://localhost:5566/icon.png) nemo porro nam ipsam dignissimos aliquid harum officiis consectetur quasi quaerat quis repellat minus eveniet aspernatur, ratione dolorum natus.
                                
                * * *
                                
                -   Lorem
                -   _ipsum_
                -   **dolor sit**
                -   _amet_
                -   xyz
                    1.  **consectetur**
                    2.  **_adipisicing_**
                    3.  [elit](https://example.com/)
                                
                > Lorem _ipsum_ **dolor sit** _amet_ **consectetur** **_adipisicing_** [elit](https://example.com/). `Corrupti fugit` officia nemo porro nam ipsam dignissimos aliquid harum officiis consectetur quasi quaerat quis repellat minus eveniet aspernatur, ratione dolorum natus.
                                
                   \s
                        Lorem ipsum dolor sit, amet consectetur adipisicing elit.\s
                        Ratione nobis aperiam unde magni libero minima eaque at placeat\s
                        molestiae odio! Ducimus ullam, nisi nostrum qui libero quidem culpa a ab.""";
        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    class TabExportingCases {
        @BeforeMethod
        public void setUp() {
            openDemoTabs();
            driver.findElement(By.id("switch-to-demo")).click();
        }

        @AfterMethod
        public void teardown() {
            driver.switchTo().window(mainWindowHandle);
            driver.findElement(By.id("close-demo")).click();
        }

        @Test
        public void allTabsLink() throws AWTException, IOException, UnsupportedFlavorException, InterruptedException {
            runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_2);

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
            runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_3);

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
            runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_4);

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
            runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_5);

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
            runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_6);

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
            runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_7);

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
            runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_8);

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
            runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_9);

            String expected = """
                - http://localhost:5566/0.html
                - Group 1
                  - http://localhost:5566/2.html
                - Untitled green group
                  - http://localhost:5566/4.html""";

            assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
        }
    }

    private static void runShortcutKeys(int[] modifiers, int key) throws AWTException {
        Robot robot = new Robot();
        for (int modifier : modifiers) {
            robot.keyPress(modifier);
            robot.delay(200);
        }
        robot.keyPress(key);
        for (int modifier : modifiers) {
            robot.keyRelease(modifier);
        }
        robot.delay(1000);
    }

    private void configureShortcutKey(String commandName, CharSequence[] modifiers, CharSequence key) throws AWTException, InterruptedException {
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
            if (Objects.equals(name, commandName)){
                cmdEntry = entry;
                break;
            }
        }

        if (cmdEntry == null) {
            throw new IllegalArgumentException("no such command: "+commandName);
        }

        WebElement editButton = shadow.findElement(cmdEntry, "#edit");
        WebElement inputBox = shadow.findElement(cmdEntry, "#input");

        // NOTE: for some reason, Robot does not work here, so using Actions to trigger DOM key events.

        Actions actions = new Actions(driver);
        actions.scrollToElement(editButton)
                .click(editButton)
                .click(inputBox);

        for (CharSequence modifier : modifiers) {
            actions = actions.keyDown(modifier);
        }
        actions.keyDown(key);
        for (CharSequence modifier : modifiers) {
            actions = actions.keyUp(modifier);
        }
        actions.perform();
    }
}
