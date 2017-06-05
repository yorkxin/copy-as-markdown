export default class Clipboard {
  constructor (contianer) {
    // A text box is required to access clipboard
    this.textbox = document.createElement("textarea");
    contianer.appendChild(this.textbox);
  }

  set (text) {
    let textbox = this.textbox;
    return new Promise(function(resolve, reject) {
      textbox.value = text;
      textbox.select();
      document.execCommand('Copy');
      textbox.value = "";
      resolve();
    });
  }
}
