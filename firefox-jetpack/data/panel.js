var commandDispatcher = function(event) {
  var button = event.target;
  self.port.emit(button.dataset.command, button.dataset.scope);

  button.classList.add('highlight-success');

  // close panel after command
  setTimeout(function() {
    self.port.emit("close");
    button.classList.remove('highlight-success')
  }, 300);
};

var buttons = document.querySelectorAll("button[data-command]");

for (var i = 0; i < buttons.length; i++) {
  buttons[i].addEventListener('click', commandDispatcher, false);
}
