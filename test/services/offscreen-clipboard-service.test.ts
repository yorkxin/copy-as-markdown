import { describe, expect, it, vi } from 'vitest';
import { createOffscreenClipboardService, OFFSCREEN_DOCUMENT_URL, OFFSCREEN_TARGET } from '../../src/services/offscreen-clipboard-service.js';

function makeApis(opts?: {
  createImpl?: () => Promise<void>;
  sendImpl?: () => Promise<unknown>;
  getContextsImpl?: () => Promise<unknown[]>;
}) {
  const createDocument = vi.fn(opts?.createImpl ?? (async () => undefined));
  const sendMessage = vi.fn(opts?.sendImpl ?? (async () => ({ ok: true })));
  const getContexts = vi.fn(opts?.getContextsImpl ?? (async () => []));
  return {
    offscreenAPI: { createDocument } as any,
    runtimeAPI: { sendMessage, getContexts } as any,
    createDocument,
    sendMessage,
    getContexts,
  };
}

describe('offscreenClipboardService', () => {
  it('creates the document once and reuses it across copies', async () => {
    const { offscreenAPI, runtimeAPI, createDocument, sendMessage } = makeApis();
    const service = createOffscreenClipboardService(offscreenAPI, runtimeAPI);

    await expect(service.copy('a')).resolves.toBe(true);
    await expect(service.copy('b')).resolves.toBe(true);

    expect(createDocument).toHaveBeenCalledTimes(1);
    expect(createDocument).toHaveBeenCalledWith(expect.objectContaining({ url: OFFSCREEN_DOCUMENT_URL }));
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenLastCalledWith({ target: OFFSCREEN_TARGET, text: 'b' });
  });

  it('de-dupes concurrent copies into a single createDocument', async () => {
    const { offscreenAPI, runtimeAPI, createDocument } = makeApis();
    const service = createOffscreenClipboardService(offscreenAPI, runtimeAPI);

    // Both copies are invoked before the first one resolves; they share the
    // in-flight documentReady promise, so createDocument runs only once.
    await Promise.all([service.copy('a'), service.copy('b')]);

    expect(createDocument).toHaveBeenCalledTimes(1);
  });

  it('reuses an existing offscreen document instead of creating another', async () => {
    const { offscreenAPI, runtimeAPI, createDocument, sendMessage } = makeApis({
      getContextsImpl: async () => [{ contextType: 'OFFSCREEN_DOCUMENT' }],
    });
    const service = createOffscreenClipboardService(offscreenAPI, runtimeAPI);

    await expect(service.copy('a')).resolves.toBe(true);

    expect(createDocument).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledOnce();
  });

  it('treats a create race as success when a document appears concurrently', async () => {
    // getContexts: empty on the pre-create check, non-empty on the recheck —
    // simulating another context creating the document during our create call.
    let checks = 0;
    const getContextsImpl = async () => {
      checks += 1;
      return checks === 1 ? [] : [{ contextType: 'OFFSCREEN_DOCUMENT' }];
    };
    const createImpl = async () => {
      throw new Error('Only a single offscreen document may be created.');
    };
    const { offscreenAPI, runtimeAPI, sendMessage } = makeApis({ getContextsImpl, createImpl });
    const service = createOffscreenClipboardService(offscreenAPI, runtimeAPI);

    await expect(service.copy('a')).resolves.toBe(true);
    expect(sendMessage).toHaveBeenCalledOnce();
  });

  it('rejects when the offscreen write fails', async () => {
    const sendImpl = async () => ({ ok: false, error: 'execCommand returned false' });
    const { offscreenAPI, runtimeAPI } = makeApis({ sendImpl });
    const service = createOffscreenClipboardService(offscreenAPI, runtimeAPI);

    await expect(service.copy('a')).rejects.toThrow('execCommand returned false');
  });

  it('retries creation after a genuine creation failure', async () => {
    let calls = 0;
    const createImpl = async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('boom');
      }
    };
    const { offscreenAPI, runtimeAPI, createDocument } = makeApis({ createImpl });
    const service = createOffscreenClipboardService(offscreenAPI, runtimeAPI);

    await expect(service.copy('a')).rejects.toThrow('boom');
    await expect(service.copy('b')).resolves.toBe(true);
    expect(createDocument).toHaveBeenCalledTimes(2);
  });
});
