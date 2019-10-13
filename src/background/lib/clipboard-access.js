// For Chrome. Use a input box in background page to interact with clipboard.
function copyByPastboardCommand(text) {
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
  return await navigator.clipboard.writeText(text);
}

/**
 *
 * @param {MarkdownResponse} response generated from markdown.js
 * @return {Promise} contains original response
 */
export async function copyMarkdownResponse(response) {
  const text = response.markdown;

  try {
    await copyByNativeAPI(text);
  } catch (error) {
    await copyByPastboardCommand(text);
  }
}
