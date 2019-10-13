// For Chrome. Use a input box in background page to interact with clipboard.
function copyByClipboardCommand(text) {
  /** @type {HTMLTextAreaElement} */
  const textBox = document.getElementById('clipboard-access');
  textBox.value = text;
  textBox.select();
  document.execCommand('Copy');
  textBox.value = '';
}

// For Firefox. Use native API. This won't work on Chrome since it requires focused document.
// See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard
async function copyByNativeAPI(text) {
  return navigator.clipboard.writeText(text);
}

/**
 *
 * @param {string} text The text to be copied
 * @return {Promise} contains original response
 */
export default async function copy(text) {
  try {
    await copyByNativeAPI(text);
  } catch (error) {
    await copyByClipboardCommand(text);
  }
}
