function createTextBox() {
  let textBox = document.createElement("textarea");
  // textBox.style.visibility = "invisible"
  textBox.style.width = "0"
  textBox.style.height = "0"
  document.body.appendChild(textBox);
  return textBox;
}

function executeCopy(textBox, text) {
  textBox.value = text;
  textBox.select();
  document.execCommand('Copy');
}

function removeTextBox(textBox) {
  document.body.removeChild(textBox);
}

function copyText(text) {
  let textBox = createTextBox()
  executeCopy(textBox, text)
  removeTextBox(textBox)
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  copyText(request.text)

  // Always send response explicitly, to avoid the problem that the sender
  // may 'fire and forget' and close the channel before it receives the response.
  sendResponse({ status: 'ok' });
});
