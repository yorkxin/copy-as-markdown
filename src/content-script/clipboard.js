let textbox = document.createElement("textarea");
// textbox.style.visibility = "invisible"
// textbox.style.display = "none"
document.body.appendChild(this.textbox);
// textbox.value = text;
textbox.select();
document.execCommand('Copy');
document.removeChild(textbox);
