package org.yorkxin.copyasmarkdown.e2e;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;
import java.util.List;

// page_url = about:blank
public class PermissionsPage {
    @FindBy(id = "request-permission")
    public WebElement requestButton;

    @FindBy(id = "close")
    public WebElement closeButton;

    public PermissionsPage(WebDriver driver) {
        PageFactory.initElements(driver, this);
    }
}