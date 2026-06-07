export interface OffscreenDocumentService {
  /** Ensure the offscreen document exists, then forward a message to it. */
  sendMessage: <T = unknown>(message: unknown) => Promise<T>;
}

export const OFFSCREEN_DOCUMENT_URL = 'dist/static/offscreen.html';

type OffscreenAPI = Pick<typeof chrome.offscreen, 'createDocument'>;
type RuntimeAPI = Pick<typeof chrome.runtime, 'sendMessage' | 'getContexts'>;

export function createOffscreenDocumentService(
  offscreenAPI: OffscreenAPI = chrome.offscreen,
  runtimeAPI: RuntimeAPI = chrome.runtime,
): OffscreenDocumentService {
  // Lazy keep-open singleton. `documentReady` is set once and reused; it is
  // reset only on a genuine creation failure so the next send can retry.
  let documentReady: Promise<void> | null = null;

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
        reasons: ['CLIPBOARD' as chrome.offscreen.Reason, 'DOM_PARSER' as chrome.offscreen.Reason],
        justification: 'Write Markdown to the clipboard and convert selection HTML to Markdown.',
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

  async function sendMessage<T = unknown>(message: unknown): Promise<T> {
    await ensureDocument();
    return await runtimeAPI.sendMessage(message) as T;
  }

  return { sendMessage };
}

export function createBrowserOffscreenDocumentService(): OffscreenDocumentService | null {
  if (typeof chrome === 'undefined' || !chrome.offscreen) {
    return null;
  }
  return createOffscreenDocumentService();
}
