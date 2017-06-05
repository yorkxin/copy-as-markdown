var ViewController = new (function() {
  var backgroundPage = chrome.extension.getBackgroundPage();

  this.bindFeature = function(id) {

    var elem = document.getElementById(id);
    elem.addEventListener("click", function() {

      // a little tricky, see http://stackoverflow.com/questions/969743
      chrome.runtime.sendMessage(id, function() {
        elem.classList.add('highlight-success');
        setTimeout(window.close, 300);
      });

    });
  };
})();

export default ViewController;
