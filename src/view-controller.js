var ViewController = new (function() {
  var backgroundPage = chrome.extension.getBackgroundPage();

  this.bindFeature = function(id, eventType, action, options) {

    var elem = document.getElementById(id);
    elem.addEventListener("click", function() {

      // a little tricky, see http://stackoverflow.com/questions/969743
      backgroundPage.CopyAsMarkdown[action](options, function() {
        elem.classList.add('highlight-success');
        setTimeout(window.close, 300);
      });

    });
  };
})();
