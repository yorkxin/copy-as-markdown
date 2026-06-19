/**
 * Regression test for the MV3 service-worker readiness race.
 *
 * background.ts must set globalThis.__listenersReady = true synchronously,
 * AFTER every top-level addListener call. getServiceWorker() gates on this
 * flag so tests never dispatch events before listeners are registered.
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
