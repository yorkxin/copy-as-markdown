import { describe, expect, it, vi } from 'vitest';
import {
  createPendingPopupFeedbackService,
} from '../../src/services/pending-popup-feedback-service.js';

function createStorageArea() {
  const store = new Map<string, unknown>();

  return {
    storageArea: {
      get: vi.fn(async (key: string) => ({ [key]: store.get(key) })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.entries(items).forEach(([key, value]) => {
          store.set(key, value);
        });
      }),
      remove: vi.fn(async (key: string) => {
        store.delete(key);
      }),
    } as unknown as browser.storage.StorageArea,
  };
}

describe('pendingPopupFeedbackService', () => {
  it('stores and reads pending feedback', async () => {
    const { storageArea } = createStorageArea();
    const service = createPendingPopupFeedbackService(storageArea);

    await service.set('empty-result');

    await expect(service.get()).resolves.toBe('empty-result');
  });

  it('consumes feedback only once', async () => {
    const { storageArea } = createStorageArea();
    const service = createPendingPopupFeedbackService(storageArea);

    await service.set('empty-result');

    await expect(service.consume()).resolves.toBe('empty-result');
    await expect(service.get()).resolves.toBeNull();
    await expect(service.consume()).resolves.toBeNull();
  });

  it('clears pending feedback', async () => {
    const { storageArea } = createStorageArea();
    const service = createPendingPopupFeedbackService(storageArea);

    await service.set('empty-result');
    await service.clear();

    await expect(service.get()).resolves.toBeNull();
  });
});
