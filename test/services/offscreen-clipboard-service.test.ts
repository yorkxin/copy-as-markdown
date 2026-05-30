import { describe, expect, it, vi } from 'vitest';
import { createOffscreenClipboardService, OFFSCREEN_DOCUMENT_URL, OFFSCREEN_TARGET } from '../../src/services/offscreen-clipboard-service.js';

function makeApis(opts?: { createImpl?: () => Promise<void>; sendImpl?: () => Promise<unknown> }) {
  const createDocument = vi.fn(opts?.createImpl ?? (async () => undefined));
  const sendMessage = vi.fn(opts?.sendImpl ?? (async () => ({ ok: true })));
  return { offscreenAPI: { createDocument } as any, runtimeAPI: { sendMessage } as any, createDocument, sendMessage };
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
    let resolveCreate: () => void = () => {};
    const createImpl = () => new Promise<void>((r) => { resolveCreate = r; });
    const { offscreenAPI, runtimeAPI, createDocument } = makeApis({ createImpl });
    const service = createOffscreenClipboardService(offscreenAPI, runtimeAPI);

    const both = Promise.all([service.copy('a'), service.copy('b')]);
    resolveCreate();
    await both;

    expect(createDocument).toHaveBeenCalledTimes(1);
  });

  it('treats an already-existing document as success', async () => {
    const createImpl = async () => { throw new Error('Only a single offscreen document may be created.'); };
    const { offscreenAPI, runtimeAPI, sendMessage } = makeApis({ createImpl });
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

  it('retries creation after a genuine (non-exists) creation failure', async () => {
    let calls = 0;
    const createImpl = async () => { calls += 1; if (calls === 1) throw new Error('boom'); };
    const { offscreenAPI, runtimeAPI, createDocument } = makeApis({ createImpl });
    const service = createOffscreenClipboardService(offscreenAPI, runtimeAPI);

    await expect(service.copy('a')).rejects.toThrow('boom');
    await expect(service.copy('b')).resolves.toBe(true);
    expect(createDocument).toHaveBeenCalledTimes(2);
  });
});
