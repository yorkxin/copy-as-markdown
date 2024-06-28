package org.yorkxin.copyasmarkdown.e2e.popup;

import org.testng.Assert;
import org.testng.annotations.*;
import org.yorkxin.copyasmarkdown.e2e.DemoPageData;

import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.io.IOException;

import static org.testng.Assert.*;

public class SimpleTest extends BaseTest {
    @Test
    public void counter()  {
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        Assert.assertTrue(popupPage.counterAll.isDisplayed());
        Assert.assertTrue(popupPage.counterHighlighted.isDisplayed());
        Assert.assertEquals("6", popupPage.counterAll.getText());
        Assert.assertEquals("3", popupPage.counterHighlighted.getText());
    }

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
}
