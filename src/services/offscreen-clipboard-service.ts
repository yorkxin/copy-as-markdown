export interface OffscreenClipboardService {
  copy: (text: string) => Promise<boolean>;
}

export const OFFSCREEN_DOCUMENT_URL = 'dist/static/offscreen.html';
export const OFFSCREEN_TARGET = 'offscreen-clipboard';

type OffscreenAPI = Pick<typeof chrome.offscreen, 'createDocument'>;
type RuntimeAPI = Pick<typeof chrome.runtime, 'sendMessage'>;

export function createOffscreenClipboardService(
  offscreenAPI: OffscreenAPI = chrome.offscreen,
  runtimeAPI: RuntimeAPI = chrome.runtime,
): OffscreenClipboardService {
  // Lazy keep-open singleton. `documentReady` is set once and reused; it is
  // reset only on a genuine creation failure so the next copy can retry.
  let documentReady: Promise<void> | null = null;

  async function createOnce(): Promise<void> {
    try {
      await offscreenAPI.createDocument({
        url: OFFSCREEN_DOCUMENT_URL,
        reasons: ['CLIPBOARD' as chrome.offscreen.Reason],
        justification: 'Write Markdown text to the system clipboard.',
      });
    } catch (error) {
      // A document already exists (concurrent caller, or a previous service
      // worker lifetime created it and persisted across the restart).
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('Only a single offscreen document')) {
        throw error;
      }
    }
  }

  async function ensureDocument(): Promise<void> {
    if (!documentReady) {
      documentReady = createOnce();
    }
    try {
      await documentReady;
    } catch (error) {
      documentReady = null;
      throw error;
    }
  }

  async function copy(text: string): Promise<boolean> {
    await ensureDocument();
    const response = await runtimeAPI.sendMessage({ target: OFFSCREEN_TARGET, text }) as
      { ok?: boolean; error?: string } | undefined;
    if (!response?.ok) {
      throw new Error(`offscreen clipboard write failed: ${response?.error ?? 'no response'}`);
    }
    return true;
  }

  return { copy };
}

export function createBrowserOffscreenClipboardService(): OffscreenClipboardService | null {
  if (typeof chrome === 'undefined' || !chrome.offscreen) {
    return null;
  }
  return createOffscreenClipboardService();
}
