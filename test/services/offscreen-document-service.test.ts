import { describe, expect, it, vi } from 'vitest';
import { createOffscreenDocumentService, OFFSCREEN_DOCUMENT_URL } from '../../src/services/offscreen-document-service.js';

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

describe('offscreenDocumentService', () => {
  it('creates the document once with both reasons and reuses it', async () => {
    const { offscreenAPI, runtimeAPI, createDocument, sendMessage } = makeApis();
    const service = createOffscreenDocumentService(offscreenAPI, runtimeAPI);

    await service.sendMessage({ a: 1 });
    await service.sendMessage({ b: 2 });

    expect(createDocument).toHaveBeenCalledTimes(1);
    expect(createDocument).toHaveBeenCalledWith(expect.objectContaining({
      url: OFFSCREEN_DOCUMENT_URL,
      reasons: ['CLIPBOARD', 'DOM_PARSER'],
    }));
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenLastCalledWith({ b: 2 });
  });

  it('de-dupes concurrent sends into a single createDocument', async () => {
    const { offscreenAPI, runtimeAPI, createDocument } = makeApis();
    const service = createOffscreenDocumentService(offscreenAPI, runtimeAPI);
    await Promise.all([service.sendMessage({ a: 1 }), service.sendMessage({ b: 2 })]);
    expect(createDocument).toHaveBeenCalledTimes(1);
  });

  it('reuses an inherited document instead of creating another', async () => {
    const { offscreenAPI, runtimeAPI, createDocument } = makeApis({
      getContextsImpl: async () => [{ contextType: 'OFFSCREEN_DOCUMENT' }],
    });
    const service = createOffscreenDocumentService(offscreenAPI, runtimeAPI);
    await service.sendMessage({ a: 1 });
    expect(createDocument).not.toHaveBeenCalled();
  });

  it('treats a create race as success when a document appears concurrently', async () => {
    let calls = 0;
    const { offscreenAPI, runtimeAPI } = makeApis({
      createImpl: async () => { throw new Error('Only a single offscreen document may be created'); },
      getContextsImpl: async () => (calls++ === 0 ? [] : [{ contextType: 'OFFSCREEN_DOCUMENT' }]),
    });
    const service = createOffscreenDocumentService(offscreenAPI, runtimeAPI);
    await expect(service.sendMessage({ a: 1 })).resolves.toEqual({ ok: true });
  });

  it('rethrows a genuine create failure and retries on the next send', async () => {
    let attempts = 0;
    const { offscreenAPI, runtimeAPI, createDocument } = makeApis({
      createImpl: async () => { attempts++; if (attempts === 1) throw new Error('boom'); },
      getContextsImpl: async () => [],
    });
    const service = createOffscreenDocumentService(offscreenAPI, runtimeAPI);
    await expect(service.sendMessage({ a: 1 })).rejects.toThrow('boom');
    await expect(service.sendMessage({ a: 1 })).resolves.toEqual({ ok: true });
    expect(createDocument).toHaveBeenCalledTimes(2);
  });
});
