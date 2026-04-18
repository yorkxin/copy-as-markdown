import type { PendingPopupFeedbackCode } from '../contracts/messages.js';

export interface PendingPopupFeedbackService {
  get: () => Promise<PendingPopupFeedbackCode | null>;
  set: (feedback: PendingPopupFeedbackCode) => Promise<void>;
  clear: () => Promise<void>;
  consume: () => Promise<PendingPopupFeedbackCode | null>;
}

function isPendingPopupFeedbackCode(value: unknown): value is PendingPopupFeedbackCode {
  return value === 'empty-result';
}

export function createPendingPopupFeedbackService(
  storageArea: browser.storage.StorageArea,
  storageKey = 'pendingPopupFeedback',
): PendingPopupFeedbackService {
  async function get(): Promise<PendingPopupFeedbackCode | null> {
    const result = await storageArea.get(storageKey);
    const feedback = result[storageKey];
    return isPendingPopupFeedbackCode(feedback) ? feedback : null;
  }

  async function set(feedback: PendingPopupFeedbackCode): Promise<void> {
    await storageArea.set({ [storageKey]: feedback });
  }

  async function clear(): Promise<void> {
    await storageArea.remove(storageKey);
  }

  async function consume(): Promise<PendingPopupFeedbackCode | null> {
    const feedback = await get();
    if (feedback) {
      await clear();
    }
    return feedback;
  }

  return {
    get,
    set,
    clear,
    consume,
  };
}

export function createBrowserPendingPopupFeedbackService(): PendingPopupFeedbackService {
  const storageArea = (browser.storage as any).session || browser.storage.local;
  return createPendingPopupFeedbackService(storageArea);
}
