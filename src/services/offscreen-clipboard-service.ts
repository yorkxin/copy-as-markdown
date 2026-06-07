import type { OffscreenDocumentService } from './offscreen-document-service.js';
import type { OffscreenClipboardResponse } from '../contracts/offscreen-messages.js';
import { OFFSCREEN_CLIPBOARD_TARGET } from '../contracts/offscreen-messages.js';

export interface OffscreenClipboardService {
  copy: (text: string) => Promise<boolean>;
}

export function createOffscreenClipboardService(
  documentService: OffscreenDocumentService,
): OffscreenClipboardService {
  async function copy(text: string): Promise<boolean> {
    const response = await documentService.sendMessage<OffscreenClipboardResponse | undefined>({
      target: OFFSCREEN_CLIPBOARD_TARGET,
      text,
    });
    if (!response?.ok) {
      throw new Error(`offscreen clipboard write failed: ${response?.error ?? 'no response'}`);
    }
    return true;
  }

  return { copy };
}
