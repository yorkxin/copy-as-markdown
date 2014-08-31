(function(ViewController) {

  ViewController.bindFeature("current-tab-link", "click", "copyCurrentTab");
  ViewController.bindFeature("all-tabs-link-as-list", "click", "copyAllTabs");
  ViewController.bindFeature("highlighted-tabs-link-as-list", "click", "copyHighlightedTabs");

  chrome.windows.getCurrent({ populate: true }, function(crWindow) {
    var tabsCount = crWindow.tabs.length;
    var highlightedCount = 0;

    for (var i = crWindow.tabs.length - 1; i >= 0; i--) {
      if (crWindow.tabs[i].highlighted === true) {
        highlightedCount++;
      }
    }

    document.getElementById("count-of-all-tabs").textContent = tabsCount;
    document.getElementById("count-of-highlighted-tabs").textContent = highlightedCount;
  });

})(ViewController);