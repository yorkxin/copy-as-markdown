import { htmlToMarkdown } from './lib/html-to-markdown.js';
import {
  OFFSCREEN_CLIPBOARD_TARGET,
  OFFSCREEN_MARKDOWN_TARGET,
} from './contracts/offscreen-messages.js';
import type {
  OffscreenClipboardMessage,
  OffscreenClipboardResponse,
  OffscreenMarkdownMessage,
  OffscreenMarkdownResponse,
  OffscreenMessage,
} from './contracts/offscreen-messages.js';

/**
 * Write text to the clipboard from inside the offscreen (extension-origin)
 * document. Uses execCommand because an offscreen document is never focused
 * (navigator.clipboard.writeText would reject), but execCommand in an
 * extension-origin document holding the clipboardWrite permission is allowed.
 */
export function copyTextToClipboard(text: string): OffscreenClipboardResponse {
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

export function convertHtmlMessage(message: OffscreenMarkdownMessage): OffscreenMarkdownResponse {
  try {
    return { ok: true, markdown: htmlToMarkdown(message.html, message.options) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `${error.name} ${error.message}` : String(error) };
  }
}

// The guard keeps the pure handlers importable when the extension runtime is absent.
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message: OffscreenMessage, _sender, sendResponse) => {
    if (!message || typeof (message as { target?: unknown }).target !== 'string') {
      return undefined;
    }
    if (message.target === OFFSCREEN_CLIPBOARD_TARGET) {
      sendResponse(copyTextToClipboard((message as OffscreenClipboardMessage).text ?? ''));
      return undefined;
    }
    if (message.target === OFFSCREEN_MARKDOWN_TARGET) {
      sendResponse(convertHtmlMessage(message as OffscreenMarkdownMessage));
      return undefined;
    }
    return undefined;
  });
}
