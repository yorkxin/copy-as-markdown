package org.yorkxin.copyasmarkdown.e2e;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;

// page_url = about:blank
public class CustomFormatPage {
    @FindBy(id = "input-name")
    public WebElement inputName;

    @FindBy(id = "input-template")
    public WebElement inputTemplate;

    @FindBy(id = "save")
    public WebElement saveButton;

    @FindBy(id = "error-template")
    public WebElement errorTemplate;

    @FindBy(id = "preview")
    public WebElement preview;

    @FindBy(id = "input-show-in-menus")
    public WebElement checkboxShowInMenus;

    public CustomFormatPage(WebDriver driver) {
        PageFactory.initElements(driver, this);
    }
}