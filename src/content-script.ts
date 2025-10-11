/* eslint-disable max-len */

/**
 * Before modifying anything here, read the following articles first:
 * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard
 * https://web.dev/async-clipboard/
 */

type CopyMethod = 'navigator_api' | 'textarea' | 'iframe';

interface CopyResult {
  ok: boolean;
  error?: string;
  method: CopyMethod;
}

/**
 * copy writes text to system clipboard in content script.
 *
 * The returned promise will always resolve as scripting.executeScript()'s callback does not handle
 * error result.
 *
 * NOTE: the whole function must be passed to content script as a function literal.
 * i.e. please do not extract any code to separate functions.
 */
export default async function copy(text: string, iframeSrc: string): Promise<CopyResult> {
  class KnownFailureError extends Error {}

  const useClipboardAPI = async (t: string): Promise<boolean> => {
    let ret: PermissionStatus | undefined;
    try {
      ret = await navigator.permissions.query({
        // @ts-ignore - clipboard-write is not in standard PermissionName
        name: 'clipboard-write', allowWithoutGesture: true,
      });
    } catch (e) {
      if (e instanceof TypeError) {
        // Firefox: `clipboard-write` is not a queryable permission,
        // but navigator.clipboard.writeText() works if declared in manifest.json
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
    console.debug(`clipboard-write permission state: ${ret?.state}`);
    throw new KnownFailureError('no permission to call navigator.clipboard API');
  };

  const useOnPageTextarea = async (t: string): Promise<boolean> => {
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

  const useIframeTextarea = async (t: string): Promise<boolean> => new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.src = iframeSrc;
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
      iframe.contentWindow?.postMessage({ cmd: 'copy', text: t }, '*');
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
      const err = error as Error;
      return Promise.resolve({ ok: false, error: `${err.name} ${err.message}`, method: 'navigator_api' });
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
      const err = error as Error;
      return Promise.resolve({ ok: false, error: `${err.name} ${err.message}`, method: 'textarea' });
    }
  }

  try {
    await useIframeTextarea(text);
    return Promise.resolve({ ok: true, method: 'iframe' });
  } catch (error) {
    const err = error as Error;
    return Promise.resolve({ ok: false, error: `${err.name} ${err.message}`, method: 'iframe' });
  }
}
