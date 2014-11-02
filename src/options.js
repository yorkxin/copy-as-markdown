var _OptionsClass = function() {
  this.load = function(localStorage, form) {
    // Local Storage can only save string values.
    // Just serialize them as JSON, and apply then to the form.

    var options_json = localStorage["options"];

    if (!options_json) {
      
    }

    // var stringProperties = form.querySelectorAll("input[type=text], textarea");
    // var booleanProperties = form.querySelectorAll("checkbox");
    // var enumPropertyValues = form.querySelectorAll("option, input[type=radio]");

    // stringProperties.forEach(function(element, index) {
    //   var name = element.attr("name");
    //   element.value = localStorage[name];
    // });

    // booleanProperties.forEach(function(element, index) {
    //   var name = element.attr("name");
    //   element.value = localStorage[name];
    // });

    // enumPropertyValues.forEach(function(element, index) {

    // });
  };

  this.save = function() {
  };
};





function saveChanges() {
  var storagePath = document.getElementById('path').value;
  if (!storagePath) {
    message('Error: No value specified');
    return;
  }
  localStorage["path"] = storagePath;

  var display = document.getElementById("hasDownloaded");
  display.innerText = "your download directory is: ".concat(storagePath)
}



document.getElementById('save').addEventListener('click',
    saveChanges);
Options = new _OptionsClass();

document.addEventListener("DOMContentLoaded", function() {
  var form = document.getElementById("options");
  Options.load(localStorage, form);
});

