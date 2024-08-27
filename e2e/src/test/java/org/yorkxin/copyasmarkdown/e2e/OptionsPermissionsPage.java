package org.yorkxin.copyasmarkdown.e2e;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindAll;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;
import java.util.List;

// page_url = about:blank
public class OptionsPermissionsPage {
    @FindBy(css = "[data-request-permission='tabs']")
    public WebElement requestTabsPermission;

    @FindBy(css = "[data-request-permission='tabGroups']")
    public WebElement requestTabGroupsPermission;

    @FindBy(css = "[data-request-permission='bookmarks']")
    public WebElement requestBookmarksPermission;

    @FindBy(css = "[data-request-permission]")
    public List<WebElement> requestButtons;

    @FindBy(css = "[data-remove-permission='tabs']")
    public WebElement removeTabsPermission;

    @FindBy(css = "[data-remove-permission='tabGroups']")
    public WebElement removeTabGroupsPermission;

    @FindBy(css = "[data-remove-permission='bookmarks']")
    public WebElement removeBookmarksPermission;

    @FindBy(css = "[data-remove-permission]")
    public List<WebElement> removeButtons;

    public OptionsPermissionsPage(WebDriver driver) {
        PageFactory.initElements(driver, this);
    }

    public WebElement getRequestButton(String permission) {
        return switch (permission) {
            case "tabs" -> this.requestTabsPermission;
            case "tabGroups" -> this.requestTabGroupsPermission;
            case "bookmarks" -> this.requestBookmarksPermission;
            default -> throw new IllegalArgumentException("invalid permission: " + permission);
        };
    }

    public WebElement getRemoveButton(String permission) {
        return switch (permission) {
            case "tabs" -> this.removeTabsPermission;
            case "tabGroups" -> this.removeTabGroupsPermission;
            case "bookmarks" -> this.removeBookmarksPermission;
            default -> throw new IllegalArgumentException("invalid permission: " + permission);
        };
    }
}