export interface OffscreenDocumentService {
  /** Ensures the offscreen document exists before forwarding the message. */
  sendMessage: <T = unknown>(message: unknown) => Promise<T>;
}

export const OFFSCREEN_DOCUMENT_URL = 'dist/static/offscreen.html';

type OffscreenAPI = Pick<typeof chrome.offscreen, 'createDocument'>;
type RuntimeAPI = Pick<typeof chrome.runtime, 'sendMessage' | 'getContexts'>;

export function createOffscreenDocumentService(
  offscreenAPI: OffscreenAPI = chrome.offscreen,
  runtimeAPI: RuntimeAPI = chrome.runtime,
): OffscreenDocumentService {
  // Successful creation is shared across sends; failures clear the promise for retry.
  let documentReady: Promise<void> | null = null;

  // getContexts avoids depending on localized, version-specific error text.
  async function hasDocument(): Promise<boolean> {
    const contexts = await runtimeAPI.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
    });
    return contexts.length > 0;
  }

  async function createOnce(): Promise<void> {
    // An offscreen document can outlive the service worker that created it.
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
      // A document appearing between the check and create makes this race successful.
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
