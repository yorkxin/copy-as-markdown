/**
 * getServiceWorker waits for __listenersReady, which background.ts sets only
 * after every top-level listener is registered.
 */

import { expect, test } from './fixtures';
import { getServiceWorker } from './helpers';

test.describe('Service worker readiness', () => {
  test('exposes __listenersReady === true once acquired', async ({ context }) => {
    const worker = await getServiceWorker(context);
    const ready = await worker.evaluate(() => (globalThis as any).__listenersReady);
    expect(ready).toBe(true);
  });
});
