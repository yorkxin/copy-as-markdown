package org.yorkxin.copyasmarkdown.e2e;

import org.testng.annotations.Test;

import java.awt.*;

import static org.testng.Assert.*;

public class CustomFormatPageTest extends BaseTest {
    @Test
    public void testUiDefaults() throws AWTException {
        openCustomFormatPage("1");
        CustomFormatPage cfp = new CustomFormatPage(driver);

        // Defaults
        assertEquals(cfp.inputName.getAttribute("value"),"Custom Format 1");
        assertEquals(cfp.inputTemplate.getAttribute("value"), "");
        assertEquals(cfp.preview.getAttribute("value"), "");
    }

    @Test
    public void testPreview() throws AWTException {
        openCustomFormatPage("1");
        CustomFormatPage cfp = new CustomFormatPage(driver);

        cfp.inputName.sendKeys("My Format");
        cfp.inputTemplate.sendKeys("{{#links}}\n{{title}}: {{url}}\n{{/links}}");
        assertEquals(cfp.preview.getAttribute("value"),"""
                        Example 1: https://example.com/1
                        Example 2: https://example.com/2
                        Example 3: https://example.com/3
                        Example 4: https://example.com/4
                        Example 5: https://example.com/5
                        Example 6: https://example.com/6
                        """);
    }

    @Test
    public void testSave() throws AWTException {
        openCustomFormatPage("2");
        CustomFormatPage cfp = new CustomFormatPage(driver);

        cfp.inputName.clear();
        cfp.inputName.sendKeys("My Format");
        cfp.inputTemplate.sendKeys("{{#links}}\n{{title}}: {{url}}\n{{/links}}");
        cfp.checkboxShowInPopupMenu.click();
        cfp.saveButton.click();

        // reload
        openCustomFormatPage("2");
        cfp = new CustomFormatPage(driver);
        assertEquals(cfp.inputName.getAttribute("value"), "My Format");
        assertEquals(cfp.inputTemplate.getAttribute("value"), "{{#links}}\n{{title}}: {{url}}\n{{/links}}");
        assertEquals(cfp.preview.getAttribute("value"), """
                        Example 1: https://example.com/1
                        Example 2: https://example.com/2
                        Example 3: https://example.com/3
                        Example 4: https://example.com/4
                        Example 5: https://example.com/5
                        Example 6: https://example.com/6
                        """);
        assertTrue(cfp.checkboxShowInPopupMenu.isSelected());
    }

    @Test
    public void testTemplateError() throws AWTException {
        openCustomFormatPage("1");
        CustomFormatPage cfp = new CustomFormatPage(driver);

        cfp.inputName.sendKeys("My Format");
        cfp.inputTemplate.sendKeys("{{#links}}\n{{title}}: {{url}}\n{{/links");
        assertTrue(cfp.errorTemplate.isDisplayed());
        assertEquals(cfp.errorTemplate.getText(), "Invalid template");
        assertFalse(cfp.saveButton.isEnabled());
        assertEquals(cfp.preview.getAttribute("value"), "");
    }
}
