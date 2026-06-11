import { describe, expect, it, vi } from 'vitest';
import { createOffscreenClipboardService } from '../../src/services/offscreen-clipboard-service.js';
import { OFFSCREEN_CLIPBOARD_TARGET } from '../../src/contracts/offscreen-messages.js';
import type { OffscreenDocumentService } from '../../src/services/offscreen-document-service.js';

function makeDocService(sendImpl?: (m: unknown) => Promise<unknown>) {
  const sendMessage = vi.fn(sendImpl ?? (async () => ({ ok: true })));
  const service: OffscreenDocumentService = { sendMessage: sendMessage as any };
  return { service, sendMessage };
}

describe('offscreenClipboardService', () => {
  it('sends a clipboard-target message and resolves on ok', async () => {
    const { service, sendMessage } = makeDocService();
    const clipboard = createOffscreenClipboardService(service);

    await expect(clipboard.copy('hello')).resolves.toBeUndefined();
    expect(sendMessage).toHaveBeenCalledWith({ target: OFFSCREEN_CLIPBOARD_TARGET, text: 'hello' });
  });

  it('throws when the offscreen document reports failure', async () => {
    const { service } = makeDocService(async () => ({ ok: false, error: 'execCommand returned false' }));
    const clipboard = createOffscreenClipboardService(service);

    await expect(clipboard.copy('x')).rejects.toThrow('offscreen clipboard write failed: execCommand returned false');
  });

  it('throws when there is no response', async () => {
    const { service } = makeDocService(async () => undefined);
    const clipboard = createOffscreenClipboardService(service);

    await expect(clipboard.copy('x')).rejects.toThrow('offscreen clipboard write failed: no response');
  });
});
