export interface OffscreenClipboardService {
  copy: (text: string) => Promise<boolean>;
}

export const OFFSCREEN_DOCUMENT_URL = 'dist/static/offscreen.html';
export const OFFSCREEN_TARGET = 'offscreen-clipboard';

type OffscreenAPI = Pick<typeof chrome.offscreen, 'createDocument'>;
type RuntimeAPI = Pick<typeof chrome.runtime, 'sendMessage' | 'getContexts'>;

export function createOffscreenClipboardService(
  offscreenAPI: OffscreenAPI = chrome.offscreen,
  runtimeAPI: RuntimeAPI = chrome.runtime,
): OffscreenClipboardService {
  // Whether this service-worker lifetime has already ensured the offscreen
  // document exists, so warm copies skip the existence check. It flips to true
  // only after a successful create/verify, so a failed attempt leaves it false
  // and the next copy retries.
  let documentReady = false;

  // Determine whether an offscreen document already exists via the structured
  // chrome.runtime.getContexts API (Chrome 116+) rather than matching the
  // English-only, version-specific createDocument error text.
  async function hasDocument(): Promise<boolean> {
    const contexts = await runtimeAPI.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
    });
    return contexts.length > 0;
  }

  async function createOnce(): Promise<void> {
    // A document may already exist — typically one created by a previous
    // service-worker lifetime that this fresh worker inherited. Reuse it
    // rather than creating a second (Chrome allows only one at a time).
    if (await hasDocument()) {
      return;
    }
    try {
      await offscreenAPI.createDocument({
        url: OFFSCREEN_DOCUMENT_URL,
        reasons: ['CLIPBOARD' as chrome.offscreen.Reason],
        justification: 'Write Markdown text to the system clipboard.',
      });
    } catch (error) {
      // If a document appeared between the check and the create (a race),
      // treat it as success; otherwise surface the real error. This keeps us
      // off any reliance on the createDocument error message string.
      if (!(await hasDocument())) {
        throw error;
      }
    }
  }

  async function ensureDocument(): Promise<void> {
    if (documentReady) {
      return;
    }
    // If createOnce throws, documentReady stays false and the next copy retries.
    await createOnce();
    documentReady = true;
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
