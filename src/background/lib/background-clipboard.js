// Clipboard access in background page
// Only available in Chrome / Chromium
export default class BackgroundClipboard {
  constructor (contianer) {
    // A text box is required to access clipboard
    this.textbox = document.createElement("textarea");
    contianer.appendChild(this.textbox);
  }

  set (text) {
    let textbox = this.textbox;
    return new Promise(function(resolve) {
      textbox.value = text;
      textbox.select();
      document.execCommand('Copy');
      textbox.value = "";
      resolve();
    });
  }
}
