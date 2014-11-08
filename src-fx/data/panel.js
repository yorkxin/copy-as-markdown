var commandDispatcher = function(event) {
  var button = event.target;
  self.port.emit(button.dataset.command, button.dataset.scope);
};

var buttons = document.querySelectorAll("button[data-command]");

for (var i = 0; i < buttons.length; i++) {
  buttons[i].addEventListener('click', commandDispatcher, false);
}
