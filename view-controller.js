var ViewController = new (function() {
  var backgroundPage = chrome.extension.getBackgroundPage();
  var messageContainer = document.getElementById("message");

  var setMessage = function(type, message) {
    messageContainer.innerText = message;
    messageContainer.setAttribute("class", type);
  };

  this.bindFeature = function(id, eventType, action, options) {

    document.getElementById("current-tab-link").addEventListener("click", function() {

      // reset message to tell user it is working.
      setMessage("normal", "...");

      // a little tricky, see http://stackoverflow.com/questions/969743
      backgroundPage.CopyAsMarkdown[action](options, function(markdown) {
        setMessage("success", "Copied!");
      });

    });
  };
})();