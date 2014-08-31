(function(ViewController) {

  ViewController.bindFeature("current-tab-link", "click", "copyCurrentTab");
  ViewController.bindFeature("all-tabs-link-as-list", "click", "copyAllTabs");

  chrome.windows.getCurrent({ populate: true }, function(crWindow) {
    var tabsCount = crWindow.tabs.length;
    document.getElementById("count-of-all-tabs").textContent = tabsCount;
  });

})(ViewController);