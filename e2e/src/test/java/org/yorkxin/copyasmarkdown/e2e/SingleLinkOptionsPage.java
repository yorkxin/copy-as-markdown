package org.yorkxin.copyasmarkdown.e2e;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;

import java.util.List;

// page_url = about:blank
public class SingleLinkOptionsPage {
    @FindBy(css = "input[type=checkbox][data-custom-format-context='single-link']")
    public List<WebElement> allCustomFormatCheckboxes;

    public SingleLinkOptionsPage(WebDriver driver) {
        PageFactory.initElements(driver, this);
    }
}