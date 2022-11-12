/**
 * Before modifying anything here, read the following articles first:
 * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard
 * https://web.dev/async-clipboard/
 */

/**
 * copy writes text to system clipboard in content script.
 *
 * The returned promise will always resolve as scripting.executeScript()'s callback does not handle
 * error result.
 *
 * NOTE: the whole function must be passed to content script as a function literal.
 * i.e. please do not extract any code to separate functions.
 * @param text
 * @returns {Promise<{ok: bool, errorMessage?: string, method: 'navigator_api'|'textarea'}>}
 */
async function copy(text) {
  const useClipboardAPI = async (t) => {
    try {
      await navigator.clipboard.writeText(t);
      return Promise.resolve({ ok: true, method: 'navigator_api' });
    } catch (error) {
      return Promise.resolve({ ok: false, error: `${error.name} ${error.message}`, method: 'navigator_api' });
    }
  };

  try {
    // XXX: In Chrome, clipboard-write permission is required in order to use
    // navigator.clipboard.writeText() in Content Script.
    //
    // There are some inconsistent behaviors when navigator.clipboard is called
    // via onCommand (Keyboard Shortcut) vs via onMenu (Context Menu).
    // The keyboard shortcut _may_ trigger permission prompt while the context menu one almost
    // don't.
    //
    // Here we behave conservatively -- if permission query don't return 'granted' then
    // don't even bother to try calling navigator.clipboard.writeText().
    //
    // See https://web.dev/async-clipboard/#security-and-permissions
    // See https://bugs.chromium.org/p/chromium/issues/detail?id=1382608#c4
    const ret = await navigator.permissions.query({
      name: 'clipboard-write', allowWithoutGesture: true,
    });
    // state will be 'granted', 'denied' or 'prompt':
    if (ret.state === 'granted') {
      return useClipboardAPI(text);
    }
    console.debug(`clipboard-write permission state: ${ret.state}`);
    // ... continue with textarea approach
  } catch (e) {
    if (e instanceof TypeError) {
      // ... And also `clipboard-write` is not a permission that can be queried in Firefox,
      // but since navigator.clipboard.writeText() always work on Firefox as long as it is declared
      // in manifest.json, we don't even bother handling it.
      return useClipboardAPI(text);
    }
    return Promise.resolve({ ok: false, error: `${e.name} ${e.message}`, method: 'navigator_api' });
  }

  return new Promise((resolve) => {
    try {
      /** @type {HTMLTextAreaElement} */
      const textBox = document.createElement('textarea');
      document.body.append(textBox);
      textBox.innerHTML = text;
      textBox.select();
      const result = document.execCommand('Copy');
      document.body.removeChild(textBox);
      if (result) {
        resolve({ ok: true, method: 'textarea' });
      }
      resolve({ ok: false, error: 'document.execCommand returned false', method: 'textarea' });
    } catch (e) {
      resolve({ ok: false, error: `${e.name} ${e.message}`, method: 'textarea' });
    }
  });
}

/**
 *
 * @param tab {chrome.tabs.Tab}
 * @param text {string}
 * @returns {Promise<void>}
 */
export default async function writeUsingContentScript(tab, text) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({
      target: {
        tabId: tab.id,
      },
      func: copy,
      args: [text],
    }, (results) => {
      const { result } = results[0];
      if (result.ok) {
        resolve(true);
      } else {
        reject(new Error(`content script failed: ${result.error} (method = ${result.method})`));
      }
    });
  });
}
