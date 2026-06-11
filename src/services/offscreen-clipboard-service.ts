import type { OffscreenDocumentService } from './offscreen-document-service.js';
import type { ClipboardService } from './clipboard-service.js';
import type { OffscreenClipboardResponse } from '../contracts/offscreen-messages.js';
import { OFFSCREEN_CLIPBOARD_TARGET } from '../contracts/offscreen-messages.js';

/**
 * Chrome backend: write via the shared offscreen document. A peer implementation
 * of ClipboardService — it resolves on a successful write, otherwise throws.
 */
export function createOffscreenClipboardService(
  documentService: OffscreenDocumentService,
): ClipboardService {
  async function copy(text: string): Promise<void> {
    const response = await documentService.sendMessage<OffscreenClipboardResponse | undefined>({
      target: OFFSCREEN_CLIPBOARD_TARGET,
      text,
    });
    if (!response?.ok) {
      throw new Error(`offscreen clipboard write failed: ${response?.error ?? 'no response'}`);
    }
  }

  return { copy };
}
