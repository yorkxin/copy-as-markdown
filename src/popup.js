(function(ViewController) {

  ViewController.bindFeature("current-tab-link", "click", "copyCurrentTab", { use_identifier: false });
  ViewController.bindFeature("current-tab-link-with-identifier", "click", "copyCurrentTab", { use_identifier: true });
  ViewController.bindFeature("all-tabs-link-as-list", "click", "copyAllTabs", { use_identifier: false });

})(ViewController);