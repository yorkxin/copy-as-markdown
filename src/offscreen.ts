const OFFSCREEN_TARGET = 'offscreen-clipboard';

interface OffscreenCopyMessage {
  target?: string;
  text?: string;
}

export interface OffscreenCopyResponse {
  ok: boolean;
  error?: string;
}

/**
 * Write text to the clipboard from inside the offscreen (extension-origin)
 * document. Uses execCommand because an offscreen document is never focused
 * (navigator.clipboard.writeText would reject), but execCommand in an
 * extension-origin document holding the clipboardWrite permission is allowed.
 */
export function copyTextToClipboard(text: string): OffscreenCopyResponse {
  const textarea = document.getElementById('clipboard') as HTMLTextAreaElement | null;
  if (!textarea) {
    return { ok: false, error: 'missing #clipboard textarea' };
  }
  try {
    textarea.value = text;
    textarea.select();
    const ok = document.execCommand('copy');
    return ok ? { ok: true } : { ok: false, error: 'execCommand returned false' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `${error.name} ${error.message}` : String(error) };
  } finally {
    textarea.value = '';
  }
}

// Registered only in the extension runtime; guarded so unit tests (no `chrome`)
// can import this module to test copyTextToClipboard in isolation.
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message: OffscreenCopyMessage, _sender, sendResponse) => {
    if (!message || message.target !== OFFSCREEN_TARGET) {
      return undefined;
    }
    sendResponse(copyTextToClipboard(message.text ?? ''));
    return undefined;
  });
}
