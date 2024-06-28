package org.yorkxin.copyasmarkdown.e2e.keyboardshortcut;

import org.openqa.selenium.By;
import org.openqa.selenium.Keys;
import org.openqa.selenium.WindowType;
import org.openqa.selenium.interactions.Actions;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.awt.*;
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.awt.event.KeyEvent;
import java.io.IOException;

import static org.testng.Assert.assertEquals;

public class OnPageContentsTest extends BaseTest{
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
        setShortcutKeyInChrome("current tab: [title](url)", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "q");
        setShortcutKeyInChrome("Copy Selection as Markdown", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "p");
    }

    public void configureKeyboardShortcutsInFirefox() throws InterruptedException, AWTException {
        openFirefoxKeyboardShortcutsPage();
        setShortcutKeyInFirefox("current-tab-link", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "q");
        setShortcutKeyInFirefox("selection-as-markdown", new CharSequence[]{Keys.CONTROL, Keys.SHIFT}, "p");
    }

    @Test
    public void currentTabLink() throws AWTException, IOException, UnsupportedFlavorException {
        driver.get("http://localhost:5566/qa.html");
        runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_Q);

        String expected = "[[QA] \\*\\*Hello\\*\\* \\_World\\_](http://localhost:5566/qa.html)";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }

    @Test
    public void copySelectionAsMarkdown () throws AWTException, IOException, UnsupportedFlavorException, InterruptedException {
        driver.get("http://localhost:5566/selection.html");
        selectAll();

        runShortcutKeys(new int[]{KeyEvent.VK_CONTROL, KeyEvent.VK_SHIFT}, KeyEvent.VK_P);
        Thread.sleep(500);

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
}
