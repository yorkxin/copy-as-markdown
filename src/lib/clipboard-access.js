/**
 *
 * @param {string} text The text to be copied
 * @return {Promise} contains original response
 */
export default async function copy(text) {
  try {
    // For Firefox. Use native API. This won't work on Chrome since it requires focused document.
    // See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // For Chrome. Use an input box in background page to interact with clipboard.
    /** @type {HTMLTextAreaElement} */
    const textBox = document.createElement('textarea');
    document.body.append(textBox);
    textBox.value = text;
    textBox.select();
    document.execCommand('Copy');
    textBox.value = '';
    document.removeChild(textBox);
    return true;
  }
}
