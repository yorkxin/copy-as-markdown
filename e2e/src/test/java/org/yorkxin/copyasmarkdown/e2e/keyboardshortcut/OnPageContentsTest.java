package org.yorkxin.copyasmarkdown.e2e.keyboardshortcut;

import org.testng.annotations.Test;
import org.yorkxin.copyasmarkdown.e2e.CustomFormatPage;

import java.awt.*;
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static org.testng.Assert.assertEquals;
import static org.yorkxin.copyasmarkdown.e2e.keyboardshortcut.tabs.BaseTest.getCommandDescriptor;

public class OnPageContentsTest extends BaseTest{
    public void configureKeyboardShortcuts(CommandDescriptor[] cds) throws InterruptedException, AWTException {
        switch (browser) {
            case BROWSER_CHROME -> configureKeyboardShortcutsInChrome(cds);
            case BROWSER_FIREFOX -> configureKeyboardShortcutsInFirefox(cds);
            default -> throw new IllegalStateException("Unexpected browser: " + browser);
        }
    }

    public void configureKeyboardShortcutsInChrome(CommandDescriptor[] commands) throws InterruptedException, AWTException {
        openChromeKeyboardShortcutsPage();
        for (CommandDescriptor command : commands) {
            setShortcutKeyInChrome(command);
        }
    }

    public void configureKeyboardShortcutsInFirefox(CommandDescriptor[] commands) throws InterruptedException, AWTException {
        openFirefoxKeyboardShortcutsPage();
        for (CommandDescriptor command : commands) {
            setShortcutKeyInFirefox(command);
        }
    }

    @Test
    public void currentTabLink() throws AWTException, IOException, UnsupportedFlavorException, InterruptedException {
        CommandDescriptor cmd = getCommandDescriptor("current-tab-link");
        configureKeyboardShortcuts(new CommandDescriptor[]{cmd});

        driver.get("http://localhost:5566/qa.html");
        runShortcutKeys(cmd.getRobotModifiers(), cmd.getRobotKey());

        String expected = "[[QA] \\*\\*Hello\\*\\* \\_World\\_](http://localhost:5566/qa.html)";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }

    @Test
    public void copySelectionAsMarkdown () throws AWTException, IOException, UnsupportedFlavorException, InterruptedException {
        Path filePath = Paths.get("support/pages/selection.md");
        String expected = Files.readString(filePath);

        CommandDescriptor cmd = getCommandDescriptor("selection-as-markdown");
        configureKeyboardShortcuts(new CommandDescriptor[]{cmd});

        driver.get("http://localhost:5566/selection.html");
        selectAll();
        runShortcutKeys(cmd.getRobotModifiers(), cmd.getRobotKey());
        Thread.sleep(500);

        // NOTE: in the selection.md file, there is a line with only four space chars right below a code block.
        // This is expected and is part of the test case, because the original <pre><code> is ended with a new line.
        assertEquals(clipboard.getData(DataFlavor.stringFlavor),expected);
    }


    @Test
    public void currentTabCustomFormat() throws AWTException, IOException, UnsupportedFlavorException, InterruptedException {
        CommandDescriptor cmd = getCommandDescriptor("current-tab-custom-format-2");
        configureKeyboardShortcuts(new CommandDescriptor[]{cmd});

        openCustomFormatPage("single-link", "2");
        CustomFormatPage cfp = new CustomFormatPage(driver);

        cfp.inputName.clear();
        cfp.inputName.sendKeys("My Format A");
        cfp.inputTemplate.sendKeys("'{{title}}','{{url}}'");
        cfp.checkboxShowInMenus.click();
        cfp.saveButton.click();

        driver.get("http://localhost:5566/qa.html");
        runShortcutKeys(cmd.getRobotModifiers(), cmd.getRobotKey());

        String expected = "'[QA] \\*\\*Hello\\*\\* \\_World\\_','http://localhost:5566/qa.html'";
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }

}
