export interface OffscreenClipboardService {
  copy: (text: string) => Promise<boolean>;
}

export const OFFSCREEN_DOCUMENT_URL = 'dist/static/offscreen.html';
export const OFFSCREEN_TARGET = 'offscreen-clipboard';

type OffscreenAPI = Pick<typeof chrome.offscreen, 'createDocument' | 'closeDocument'>;
type RuntimeAPI = Pick<typeof chrome.runtime, 'sendMessage'>;

export function createOffscreenClipboardService(
  offscreenAPI: OffscreenAPI = chrome.offscreen,
  runtimeAPI: RuntimeAPI = chrome.runtime,
): OffscreenClipboardService {
  // The offscreen document is created on demand, used for a single write, then
  // closed immediately — it is never kept open. Copies are serialized through
  // this queue so we never race createDocument/closeDocument against Chrome's
  // "only one offscreen document at a time" constraint.
  let queue: Promise<unknown> = Promise.resolve();

  async function openDocument(): Promise<void> {
    try {
      await offscreenAPI.createDocument({
        url: OFFSCREEN_DOCUMENT_URL,
        reasons: ['CLIPBOARD' as chrome.offscreen.Reason],
        justification: 'Write Markdown text to the system clipboard.',
      });
    } catch (error) {
      // A leftover document already exists (e.g. a previous close failed, or a
      // document was orphaned by a prior service-worker lifetime). Reuse it.
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('Only a single offscreen document')) {
        throw error;
      }
    }
  }

  async function writeOnce(text: string): Promise<boolean> {
    await openDocument();
    try {
      const response = await runtimeAPI.sendMessage({ target: OFFSCREEN_TARGET, text }) as
        { ok?: boolean; error?: string } | undefined;
      if (!response?.ok) {
        throw new Error(`offscreen clipboard write failed: ${response?.error ?? 'no response'}`);
      }
      return true;
    } finally {
      // Close as soon as the document is no longer needed, even on write failure.
      await offscreenAPI.closeDocument().catch(() => { /* already closed */ });
    }
  }

  function copy(text: string): Promise<boolean> {
    const run = queue.then(() => writeOnce(text));
    // Keep the chain alive regardless of this copy's outcome.
    queue = run.then(() => undefined, () => undefined);
    return run;
  }

  return { copy };
}

export function createBrowserOffscreenClipboardService(): OffscreenClipboardService | null {
  if (typeof chrome === 'undefined' || !chrome.offscreen) {
    return null;
  }
  return createOffscreenClipboardService();
}
