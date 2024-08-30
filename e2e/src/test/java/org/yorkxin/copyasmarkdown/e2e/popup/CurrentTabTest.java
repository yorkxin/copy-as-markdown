package org.yorkxin.copyasmarkdown.e2e.popup;

import org.testng.Assert;
import org.testng.annotations.Test;
import org.yorkxin.copyasmarkdown.e2e.CustomFormatPage;
import org.yorkxin.copyasmarkdown.e2e.DemoPageData;

import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.io.IOException;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertTrue;

public class CurrentTabTest extends BaseTest {
    @Test
    public void currentTabLink() throws IOException, UnsupportedFlavorException, InterruptedException {
        // XXX: because the popup is using chrome.tabs.query() to get tab with id from parameter,
        // it is necessary to grant the 'tabs' permission. Technically, 'activeTab' is the tab that opens the popup window.
        // In the actual Chrome / Firefox, 'tabs' permission is not required to get title / url of the current tab.
        grantPermission("tabs");

        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        popupPage.currentTabLinkButton.click();
        Thread.sleep(500);
        String expected = "[Page 0 - Copy as Markdown](http://localhost:5566/0.html)";
        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }

    @Test
    public void currentTabAsCustomFormat() throws InterruptedException, IOException, UnsupportedFlavorException {
        openCustomFormatPage("single-link", "1");
        CustomFormatPage cfp = new CustomFormatPage(driver);

        cfp.inputName.clear();
        cfp.inputName.sendKeys("My Format A");
        cfp.inputTemplate.sendKeys("""
                '{{title}}','{{url}}'
                """);
        cfp.checkboxShowInMenus.click();
        cfp.saveButton.click();

        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        assertTrue(popupPage.currentTabCustomFormat1.isDisplayed());
        assertEquals(popupPage.currentTabCustomFormat1.getText(), "Current tab (My Format A)");
        driver.switchTo().window(popupHandle);
        popupPage.currentTabCustomFormat1.click();
        Thread.sleep(200);
        String expected = """
                'Page 0 - Copy as Markdown','http://localhost:5566/0.html'
                """;
        assertEquals(clipboard.getData(DataFlavor.stringFlavor), expected);
    }
}
