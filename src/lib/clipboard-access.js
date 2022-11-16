/* eslint-disable max-len */
/* eslint-disable max-classes-per-file */

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
 * @returns {Promise<{ok: boolean, errorMessage?: string, method: 'navigator_api'|'textarea'}>}
 */
async function copy(text) {
  class KnownFailureError extends Error {}

  const useClipboardAPI = async (t) => {
    /** @type {PermissionStatus} */
    let ret;
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
      ret = await navigator.permissions.query({
        name: 'clipboard-write', allowWithoutGesture: true,
      });
    } catch (e) {
      if (e instanceof TypeError) {
        // ... And also `clipboard-write` is not a permission that can be queried in Firefox,
        // but since navigator.clipboard.writeText() always work on Firefox as long as it is declared
        // in manifest.json, we don't even bother handling it.
        await navigator.clipboard.writeText(t);
        return true;
      }

      throw e;
    }

    // state will be 'granted', 'denied' or 'prompt':
    if (ret && ret.state === 'granted') {
      await navigator.clipboard.writeText(t);
      return true;
    }
    console.debug(`clipboard-write permission state: ${ret.state}`);
    throw new KnownFailureError('no permission to call navigator.clipboard API');
  };

  const useOnPageTextarea = async (t) => {
    /** @type {HTMLTextAreaElement} */
    const textBox = document.createElement('textarea');
    document.body.appendChild(textBox);
    try {
      textBox.innerHTML = t;
      textBox.select();
      const result = document.execCommand('Copy');
      if (result) {
        return Promise.resolve(true);
      }
      return Promise.reject(new KnownFailureError('execCommand returned false'));
    } catch (e) {
      return Promise.reject(e);
    } finally {
      if (document.body.contains(textBox)) {
        document.body.removeChild(textBox);
      }
    }
  };

  const useIframeTextarea = async (t) => new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('dist/iframe-copy.html');
    iframe.width = '10';
    iframe.height = '10';
    iframe.style.position = 'absolute';
    iframe.style.left = '-100px';
    document.body.appendChild(iframe);
    window.addEventListener('message', (event) => {
      switch (event.data.topic) {
        case 'iframe-copy-response': {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          if (event.data.ok) {
            resolve(true);
          } else {
            reject(new KnownFailureError(event.data.reason));
          }
          break;
        }
        default: {
          reject(new Error(`unknown topic ${event.data.topic}`));
        }
      }
    });

    setTimeout(() => {
      iframe.contentWindow.postMessage({ cmd: 'copy', text: t }, '*');
    }, 100);
  });

  try {
    await useClipboardAPI(text);
    return Promise.resolve({ ok: true, method: 'navigator_api' });
  } catch (error) {
    if (error instanceof KnownFailureError) {
      console.debug(error);
      // try next method
    } else {
      return Promise.resolve({ ok: false, error: `${error.name} ${error.message}`, method: 'navigator_api' });
    }
  }

  try {
    await useOnPageTextarea(text);
    return Promise.resolve({ ok: true, method: 'textarea' });
  } catch (error) {
    if (error instanceof KnownFailureError) {
      console.debug(error);
      // try next method
    } else {
      return Promise.resolve({ ok: false, error: `${error.name} ${error.message}`, method: 'textarea' });
    }
  }

  try {
    await useIframeTextarea(text);
    return Promise.resolve({ ok: true, method: 'iframe' });
  } catch (error) {
    console.debug(error);
    return Promise.resolve({ ok: false, error: `${error.name} ${error.message}`, method: 'iframe' });
  }
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
