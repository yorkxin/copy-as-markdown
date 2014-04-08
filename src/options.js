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

Options = new _OptionsClass();

document.addEventListener("DOMContentLoaded", function() {
  var form = document.getElementById("options");
  Options.load(localStorage, form);
});
