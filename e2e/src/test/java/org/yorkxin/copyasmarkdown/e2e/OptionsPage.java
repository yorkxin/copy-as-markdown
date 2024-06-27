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
    @FindBy(css = "#form-style-of-unordered-list [name='character'][value='dash']")
    public WebElement unorderedListCharacterDash;

    @FindBy(css = "#form-style-of-unordered-list [name='character'][value='asterisk']")
    public WebElement unorderedListCharacterAsterisk;

    @FindBy(css = "#form-style-of-unordered-list [name='character'][value='plus']")
    public WebElement unorderedListCharacterPlus;

    @FindBy(css = "#form-style-of-tab-group-indentation [name='indentation'][value='spaces']")
    public WebElement tabGroupIndentationSpaces;

    @FindBy(css = "#form-style-of-tab-group-indentation [name='indentation'][value='tab']")
    public WebElement tabGroupIndentationTab;

    @FindBy(css = "#form-link-text-always-escape-brackets [name='enabled']")
    public WebElement enableLinkTextAlwaysEscapeBrackets;

    @FindBy(css = "[data-request-permission='tabs']")
    public WebElement requestTabsPermission;

    @FindBy(css = "[data-request-permission='tabGroups']")
    public WebElement requestTabGroupsPermission;

    @FindBy(css = "[data-request-permission='bookmarks']")
    public WebElement requestBookmarksPermission;

    @FindBy(css = "[data-remove-permission]")
    public List<WebElement> removeButtons;

    public OptionsPage(WebDriver driver) {
        PageFactory.initElements(driver, this);
    }
}