package org.yorkxin.copyasmarkdown.e2e.popup;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;

import java.util.List;

// page_url = https://www.jetbrains.com/
public class PopupPage {
    @FindBy(css = "[name='action'][value='export-tabs']")
    public List<WebElement> allTabExportButtons;

    @FindBy(id = "display-count-all-tabs")
    public WebElement counterAll;

    @FindBy(id = "display-count-highlighted-tabs")
    public WebElement counterHighlighted;

    @FindBy(id = "current-tab-link")
    public WebElement currentTabLinkButton;

    @FindBy(id = "all-tabs-list")
    public WebElement allTabsListButton;

    @FindBy(id = "all-tabs-task-list")
    public WebElement allTabsTaskListButton;

    @FindBy(id = "all-tabs-title")
    public WebElement allTabsTitleButton;

    @FindBy(id = "all-tabs-url")
    public WebElement allTabsUrlButton;

    @FindBy(id = "highlighted-tabs-list")
    public WebElement highlightedTabsListButton;

    @FindBy(id = "highlighted-tabs-task-list")
    public WebElement highlightedTabsTaskListButton;

    @FindBy(id = "highlighted-tabs-title")
    public WebElement highlightedTabsTitleButton;

    @FindBy(id = "highlighted-tabs-url")
    public WebElement highlightedTabsUrlButton;

    @FindBy(css = "button[value='export-tabs'][data-scope='all'][data-format='custom-format'][data-custom-format-slot='1']")
    public WebElement allTabsCustomFormat1;

    @FindBy(css = "button[value='export-tabs'][data-scope='highlighted'][data-format='custom-format'][data-custom-format-slot='2']")
    public WebElement highlightedTabsCustomFormat2;

    @FindBy(css = "button[value='export-current-tab'][data-format='custom-format'][data-custom-format-slot='1']")
    public WebElement currentTabCustomFormat1;

    @FindBy(css="button[value='export-tabs'][data-format='custom-format']")
    public List<WebElement> allExportTabsCustomFormatButtons;

    @FindBy(css="button[value='export-current-tabs'][data-format='custom-format']")
    public List<WebElement> allExportCurrentTabCustomFormatButtons;

    public PopupPage(WebDriver driver) {
        PageFactory.initElements(driver, this);
    }
}
