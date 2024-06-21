package org.yorkxin.copyasmarkdown.e2e;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindAll;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.FindBys;
import org.openqa.selenium.support.PageFactory;
import java.util.List;

// page_url = about:blank
public class OptionsPage {
    @FindBy(css = "[data-request-permission]")
    public List<WebElement> requestButtons;

    @FindBy(css = "[data-remove-permission]")
    public List<WebElement> removeButtons;

    public OptionsPage(WebDriver driver) {
        PageFactory.initElements(driver, this);
    }
}