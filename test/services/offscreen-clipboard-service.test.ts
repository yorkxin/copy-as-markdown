import { describe, expect, it, vi } from 'vitest';
import { createOffscreenClipboardService, OFFSCREEN_DOCUMENT_URL, OFFSCREEN_TARGET } from '../../src/services/offscreen-clipboard-service.js';

function makeApis(opts?: {
  createImpl?: () => Promise<void>;
  sendImpl?: () => Promise<unknown>;
  closeImpl?: () => Promise<void>;
}) {
  const createDocument = vi.fn(opts?.createImpl ?? (async () => undefined));
  const closeDocument = vi.fn(opts?.closeImpl ?? (async () => undefined));
  const sendMessage = vi.fn(opts?.sendImpl ?? (async () => ({ ok: true })));
  return {
    offscreenAPI: { createDocument, closeDocument } as any,
    runtimeAPI: { sendMessage } as any,
    createDocument,
    closeDocument,
    sendMessage,
  };
}

describe('offscreenClipboardService', () => {
  it('creates and closes the document for each copy', async () => {
    const { offscreenAPI, runtimeAPI, createDocument, sendMessage, closeDocument } = makeApis();
    const service = createOffscreenClipboardService(offscreenAPI, runtimeAPI);

    await expect(service.copy('a')).resolves.toBe(true);
    await expect(service.copy('b')).resolves.toBe(true);

    expect(createDocument).toHaveBeenCalledTimes(2);
    expect(createDocument).toHaveBeenCalledWith(expect.objectContaining({ url: OFFSCREEN_DOCUMENT_URL }));
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenLastCalledWith({ target: OFFSCREEN_TARGET, text: 'b' });
    expect(closeDocument).toHaveBeenCalledTimes(2);
  });

  it('serializes copies so a new document is not created until the previous one is closed', async () => {
    const order: string[] = [];
    const createImpl = async () => {
      order.push('create');
    };
    const sendImpl = async () => {
      order.push('send');
      return { ok: true };
    };
    const closeImpl = async () => {
      order.push('close');
    };
    const { offscreenAPI, runtimeAPI } = makeApis({ createImpl, sendImpl, closeImpl });
    const service = createOffscreenClipboardService(offscreenAPI, runtimeAPI);

    await Promise.all([service.copy('a'), service.copy('b')]);

    expect(order).toEqual(['create', 'send', 'close', 'create', 'send', 'close']);
  });

  it('reuses a leftover document when creation reports it already exists', async () => {
    const createImpl = async () => {
      throw new Error('Only a single offscreen document may be created.');
    };
    const { offscreenAPI, runtimeAPI, sendMessage, closeDocument } = makeApis({ createImpl });
    const service = createOffscreenClipboardService(offscreenAPI, runtimeAPI);

    await expect(service.copy('a')).resolves.toBe(true);
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(closeDocument).toHaveBeenCalledOnce();
  });

  it('rejects when the offscreen write fails and still closes the document', async () => {
    const sendImpl = async () => ({ ok: false, error: 'execCommand returned false' });
    const { offscreenAPI, runtimeAPI, closeDocument } = makeApis({ sendImpl });
    const service = createOffscreenClipboardService(offscreenAPI, runtimeAPI);

    await expect(service.copy('a')).rejects.toThrow('execCommand returned false');
    expect(closeDocument).toHaveBeenCalledOnce();
  });

  it('retries after a genuine (non-exists) creation failure', async () => {
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
