package org.yorkxin.copyasmarkdown.e2e;

import org.testng.annotations.Test;

import java.awt.*;

import static org.testng.Assert.assertFalse;
import static org.testng.Assert.assertTrue;

public class OptionsPageTest extends BaseTest {
    @Test
    public void testFormatsUi() throws AWTException {
        openOptionsPage();
        OptionsPage op = new OptionsPage(driver);

        // Defaults
        assertTrue(op.unorderedListCharacterDash.isEnabled());
        assertFalse(op.enableLinkTextAlwaysEscapeBrackets.isSelected());

        op.unorderedListCharacterAsterisk.click();
        driver.get(driver.getCurrentUrl());
        assertTrue(op.unorderedListCharacterAsterisk.isSelected());

        op.unorderedListCharacterPlus.click();
        driver.get(driver.getCurrentUrl());
        assertTrue(op.unorderedListCharacterPlus.isSelected());

        op.unorderedListCharacterDash.click();
        driver.get(driver.getCurrentUrl());
        assertTrue(op.unorderedListCharacterDash.isSelected());

        op.enableLinkTextAlwaysEscapeBrackets.click();
        driver.get(driver.getCurrentUrl());
        assertTrue(op.enableLinkTextAlwaysEscapeBrackets.isSelected());
    }

    @Test
    public void testTabGroupWithoutPermission() throws AWTException {
        removeAllPermissions();

        openOptionsPage();
        OptionsPage op = new OptionsPage(driver);

        // Defaults
        assertTrue(op.tabGroupIndentationSpaces.isSelected());
        assertFalse(op.tabGroupIndentationTab.isEnabled());
        assertFalse(op.tabGroupIndentationSpaces.isEnabled());
    }

    @Test
    public void testTabGroupWithPermission() {
        grantPermission("tabGroups");

        openOptionsPage();
        OptionsPage op = new OptionsPage(driver);
        assertTrue(op.tabGroupIndentationTab.isEnabled());
        assertTrue(op.tabGroupIndentationSpaces.isEnabled());

        op.tabGroupIndentationTab.click();
        driver.get(driver.getCurrentUrl());
        assertTrue(op.tabGroupIndentationTab.isEnabled());
    }
}
