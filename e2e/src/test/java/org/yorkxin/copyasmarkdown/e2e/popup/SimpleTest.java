package org.yorkxin.copyasmarkdown.e2e.popup;

import org.testng.Assert;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;
import org.yorkxin.copyasmarkdown.e2e.DemoPageData;

import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.io.IOException;

import static org.testng.Assert.assertEquals;

public class SimpleTest extends BaseTest {
    @BeforeMethod
    public void setUp() {
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
    }

    @Test
    public void counter() throws IOException, UnsupportedFlavorException {
        Assert.assertEquals("6", popupPage.counterAll.getText());
        Assert.assertEquals("3", popupPage.counterHighlighted.getText());
    }

    @Test
    public void currentTabLink() throws IOException, UnsupportedFlavorException, InterruptedException {
        popupPage.currentTabLinkButton.click();
        Thread.sleep(1000);
        String expected = "[Page 0 - Copy as Markdown](http://localhost:5566/0.html)";
        assertEquals(expected, clipboard.getData(DataFlavor.stringFlavor));
    }
}
