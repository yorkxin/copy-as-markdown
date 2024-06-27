package org.yorkxin.copyasmarkdown.e2e.keyboardshortcut;

import org.openqa.selenium.Keys;

import java.awt.event.KeyEvent;
import java.util.Arrays;

public class CommandDescriptor {
    final String name;
    final String command;
    final CharSequence[] modifiers;
    final String key;
    private final int[] robotModifiers;
    private final int robotKey;

    public CommandDescriptor(String name, String command, CharSequence[] modifiers, String key) {
        this.name = name;
        this.command = command;
        this.modifiers = modifiers;
        this.key = key;
        this.robotModifiers = Arrays.stream(modifiers).map(ch -> switch (ch) {
            case Keys.CONTROL -> KeyEvent.VK_CONTROL;
            case Keys.SHIFT -> KeyEvent.VK_SHIFT;
            case Keys.ALT -> KeyEvent.VK_ALT;
            default -> throw new IllegalStateException("Invalid modifier: " + ch);
        }).mapToInt(i->i).toArray();
        this.robotKey = KeyEvent.getExtendedKeyCodeForChar(key.charAt(0));
    }

    public int[] getRobotModifiers() {
        return robotModifiers;
    }

    public int getRobotKey() {
        return robotKey;
    }
}
