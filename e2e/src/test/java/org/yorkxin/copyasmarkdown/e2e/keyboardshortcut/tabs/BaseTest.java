package org.yorkxin.copyasmarkdown.e2e.keyboardshortcut.tabs;

import org.openqa.selenium.InvalidArgumentException;
import org.openqa.selenium.Keys;
import org.testng.annotations.DataProvider;
import org.yorkxin.copyasmarkdown.e2e.keyboardshortcut.CommandDescriptor;

import java.awt.*;
import java.util.Objects;

public class BaseTest extends org.yorkxin.copyasmarkdown.e2e.keyboardshortcut.BaseTest {
    public static CommandDescriptor[] allCommandDescriptors =  new CommandDescriptor[]{
            new CommandDescriptor("all tabs: - [title](url)", "all-tabs-link-as-list", new CharSequence[]{Keys.ALT, Keys.SHIFT}, "w"),
            new CommandDescriptor("all tabs: - [ ] [title](url)", "all-tabs-link-as-task-list", new CharSequence[]{Keys.ALT, Keys.SHIFT}, "e"),
            new CommandDescriptor("all tabs: - title", "all-tabs-title-as-list", new CharSequence[]{Keys.ALT, Keys.SHIFT}, "r"),
            new CommandDescriptor("all tabs: - url", "all-tabs-url-as-list", new CharSequence[]{Keys.ALT, Keys.SHIFT}, "t"),
            new CommandDescriptor("selected tabs: - [title](url)", "highlighted-tabs-link-as-list", new CharSequence[]{Keys.ALT, Keys.SHIFT}, "y"),
            new CommandDescriptor("selected tabs: - [ ] [title](url)", "highlighted-tabs-link-as-task-list", new CharSequence[]{Keys.ALT, Keys.SHIFT}, "u"),
            new CommandDescriptor("selected tabs: - title", "highlighted-tabs-title-as-list", new CharSequence[]{Keys.ALT, Keys.SHIFT}, "i"),
            new CommandDescriptor("selected tabs: - url", "highlighted-tabs-url-as-list", new CharSequence[]{Keys.ALT, Keys.SHIFT}, "o"),
            new CommandDescriptor("all tabs: custom format 1","all-tabs-custom-format-1", new CharSequence[]{Keys.ALT,Keys.SHIFT},"a"),
            new CommandDescriptor("all tabs: custom format 2","all-tabs-custom-format-2", new CharSequence[]{Keys.ALT,Keys.SHIFT},"s"),
            new CommandDescriptor("all tabs: custom format 3","all-tabs-custom-format-3", new CharSequence[]{Keys.ALT,Keys.SHIFT},"d"),
            new CommandDescriptor("all tabs: custom format 4","all-tabs-custom-format-4", new CharSequence[]{Keys.ALT,Keys.SHIFT},"f"),
            new CommandDescriptor("all tabs: custom format 5","all-tabs-custom-format-5", new CharSequence[]{Keys.ALT,Keys.SHIFT},"g"),
            new CommandDescriptor("selected tabs: custom format 1","highlighted-tabs-custom-format-1", new CharSequence[]{Keys.ALT,Keys.SHIFT},"h"),
            new CommandDescriptor("selected tabs: custom format 2","highlighted-tabs-custom-format-2", new CharSequence[]{Keys.ALT,Keys.SHIFT},"j"),
            new CommandDescriptor("selected tabs: custom format 3","highlighted-tabs-custom-format-3", new CharSequence[]{Keys.ALT,Keys.SHIFT},"k"),
            new CommandDescriptor("selected tabs: custom format 4","highlighted-tabs-custom-format-4", new CharSequence[]{Keys.ALT,Keys.SHIFT},"l"),
            new CommandDescriptor("selected tabs: custom format 5","highlighted-tabs-custom-format-5", new CharSequence[]{Keys.ALT,Keys.SHIFT},"z"),
        };

    public static CommandDescriptor getCommandDescriptor(String command) {
        // TODO: make index
        for (CommandDescriptor cd : allCommandDescriptors) {
            if (Objects.equals(cd.command, command)) {
                return cd;
            }
        }
        throw new InvalidArgumentException("No such command:"+command);
    }

    @DataProvider(name = "allCommands")
    public static Object[][] allCommands() {
        CommandDescriptor[] cds = allCommandDescriptors;
        Object[][] ret = new Object[cds.length][];
        for (int i = 0; i < cds.length; i++) {
            ret[i] = new Object[]{cds[i].command};
        }
        return ret;
    }

    public void configureKeyboardShortcuts() throws InterruptedException, AWTException {
        switch (browser) {
            case BROWSER_CHROME -> configureKeyboardShortcutsInChrome();
            case BROWSER_FIREFOX -> configureKeyboardShortcutsInFirefox();
            default -> throw new IllegalStateException("Unexpected browser: " + browser);
        }
    }

    public void configureKeyboardShortcutsInChrome() throws InterruptedException, AWTException {
        openChromeKeyboardShortcutsPage();
        for (CommandDescriptor cmd : allCommandDescriptors) {
            setShortcutKeyInChrome(cmd.name, cmd.modifiers, cmd.key);
        }
    }

    public void configureKeyboardShortcutsInFirefox() throws InterruptedException, AWTException {
        openFirefoxKeyboardShortcutsPage();
        for (CommandDescriptor cmd : allCommandDescriptors) {
            setShortcutKeyInFirefox(cmd.command, cmd.modifiers, cmd.key);
        }
    }
}
