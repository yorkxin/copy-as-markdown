export default class Clipboard {
  constructor (contianer) {
    // A text box is required to access clipboard
    this.textbox = document.createElement("textarea");
    contianer.appendChild(this.textbox);
  }

  set (text, okCallback) {
    this.textbox.value = text;
    this.textbox.select();
    document.execCommand('Copy');
    this.textbox.value = "";

    okCallback();
  }
}
