package org.yorkxin.copyasmarkdown.e2e.popup;

import org.openqa.selenium.WebElement;
import org.testng.Assert;
import org.testng.annotations.*;
import org.yorkxin.copyasmarkdown.e2e.DemoPageData;
import org.yorkxin.copyasmarkdown.e2e.MultipleLinksOptionsPage;
import org.yorkxin.copyasmarkdown.e2e.SingleLinkOptionsPage;

import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.io.IOException;

import static org.testng.Assert.*;

public class DisplayTest extends BaseTest {
    @Test
    public void counter()  {
        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        Assert.assertTrue(popupPage.counterAll.isDisplayed());
        Assert.assertTrue(popupPage.counterHighlighted.isDisplayed());
        Assert.assertEquals("8", popupPage.counterAll.getText());
        Assert.assertEquals("3", popupPage.counterHighlighted.getText());
    }

    @Test
    public void showCustomFormatOfExportTabs() {
        openMultipleLinksOptionsPage();
        MultipleLinksOptionsPage page = new MultipleLinksOptionsPage(driver);
        for (WebElement checkbox : page.allCustomFormatCheckboxes) {
            if (!checkbox.isSelected()) {
                checkbox.click();
            }
        }

        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        for (WebElement button : popupPage.allExportTabsCustomFormatButtons) {
            Assert.assertTrue(button.isDisplayed());
        }
    }

    @Test
    public void showCustomFormatOfCurrentTab() {
        openSingleLinkOptionsPage();
        SingleLinkOptionsPage page = new SingleLinkOptionsPage(driver);
        for (WebElement checkbox : page.allCustomFormatCheckboxes) {
            if (!checkbox.isSelected()) {
                checkbox.click();
            }
        }

        DemoPageData dpd = openDemoTabs(false);
        openPopupWindow(dpd);
        for (WebElement button : popupPage.allExportCurrentTabCustomFormatButtons) {
            Assert.assertTrue(button.isDisplayed());
        }
    }
}
