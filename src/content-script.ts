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
  class KnownFailureError extends Error { }

  const useClipboardAPI = async (t: string): Promise<boolean> => {
    let ret: PermissionStatus | undefined;
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
        // @ts-expect-error - clipboard-write is not in standard PermissionName
        name: 'clipboard-write',
        allowWithoutGesture: true,
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
    const channel = new MessageChannel();
    let settled = false;
    let timeoutId = 0;

    const cleanup = () => {
      iframe.removeEventListener('load', handleLoad);
      channel.port1.onmessage = null;
      channel.port1.close();
      window.clearTimeout(timeoutId);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    };

    const settle = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      fn();
    };

    channel.port1.onmessage = (event: MessageEvent) => {
      if (typeof event.data !== 'object' || event.data === null || event.data.topic !== 'iframe-copy-response') {
        return;
      }

      if (event.data.ok) {
        settle(() => resolve(true));
      } else {
        settle(() => reject(new KnownFailureError(event.data.reason || 'iframe copy failed')));
      }
    };

    const handleLoad = () => {
      iframe.contentWindow?.postMessage({ cmd: 'copy', text: t }, '*', [channel.port2]);
    };

    iframe.addEventListener('load', handleLoad, { once: true });
    document.body.appendChild(iframe);
    timeoutId = window.setTimeout(() => {
      settle(() => reject(new KnownFailureError('iframe copy timed out')));
    }, 5000);
  });

  try {
    await useClipboardAPI(text);
    return Promise.resolve({ ok: true, method: 'navigator_api' });
  } catch (error) {
    if (error instanceof KnownFailureError) {
      // try next method
    } else {
      const err = error as Error;
      return Promise.resolve({ ok: false, error: `${err.name} ${err.message}`, method: 'navigator_api' });
    }
  }

  try {
    await useIframeTextarea(text);
    return Promise.resolve({ ok: true, method: 'iframe' });
  } catch (error) {
    if (error instanceof KnownFailureError) {
      // try next method
    } else {
      const err = error as Error;
      return Promise.resolve({ ok: false, error: `${err.name} ${err.message}`, method: 'iframe' });
    }
  }

  try {
    await useOnPageTextarea(text);
    return Promise.resolve({ ok: true, method: 'textarea' });
  } catch (error) {
    const err = error as Error;
    return Promise.resolve({ ok: false, error: `${err.name} ${err.message}`, method: 'textarea' });
  }
}
