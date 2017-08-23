function createTextbox() {
  let textbox = document.createElement("textarea");
  // textbox.style.visibility = "invisible"
  textbox.style.width = "0"
  textbox.style.height = "0"
  document.body.appendChild(textbox);
  return textbox;
}

function executeCopy(textbox, text) {
  textbox.value = text;
  textbox.select();
  document.execCommand('Copy');
}

function removeTextbox(textbox) {
  document.body.removeChild(textbox);
}

export default function copyText(text) {
  return new Promise((resolve) => {
    let textbox = createTextbox()
    executeCopy(textbox, text)
    removeTextbox(textbox)
    resolve()
  })
}
