/**
 * Helper utilities for E2E tests
 */

import type { BrowserContext, Page, Worker } from '@playwright/test';
import type { ClipboardMockCall } from '../../src/services/clipboard-service.js';

/**
 * Get all mock clipboard calls from the service worker
 */
export async function getMockClipboardCalls(serviceWorker: Worker): Promise<ClipboardMockCall[]> {
  return await serviceWorker.evaluate(async () => {
    const mock = (globalThis as any).__mockClipboardService;
    if (!mock) {
      throw new Error('Mock clipboard service not found in service worker');
    }
    return await mock.getCalls();
  });
}

/**
 * Reset the mock clipboard service in the service worker
 */
export async function resetMockClipboard(serviceWorker: Worker): Promise<void> {
  await serviceWorker.evaluate(async () => {
    const mock = (globalThis as any).__mockClipboardService;
    if (!mock) {
      throw new Error('Mock clipboard service not found in service worker');
    }
    await mock.reset();
  });
}

/**
 * Wait for the mock clipboard to have at least one call (with timeout)
 */
export async function waitForMockClipboard(serviceWorker: Worker, timeout = 3000): Promise<ClipboardMockCall> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const calls = await getMockClipboardCalls(serviceWorker);
    if (calls.length > 0) {
      return calls[calls.length - 1]!;
    }

    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`Mock clipboard had no calls after ${timeout}ms`);
}

/**
 * Get the service worker for the extension
 * Filters by chrome-extension:// URL to ensure we get the extension's worker,
 * not some other service worker (like from PWAs or other extensions)
 *
 * Also polls to ensure Chrome APIs are ready before returning
 */
export async function getServiceWorker(context: BrowserContext, timeout = 10000) {
  // Get all service workers and filter for extension workers
  const serviceWorkers = context.serviceWorkers();
  let extensionWorker = serviceWorkers.find(sw =>
    sw.url().startsWith('chrome-extension://'),
  );

  // If not found yet, wait for it
  if (!extensionWorker) {
    extensionWorker = await context.waitForEvent('serviceworker', {
      predicate: worker => worker.url().startsWith('chrome-extension://'),
      timeout,
    });
  }

  // Poll until Chrome APIs are ready
  const startTime = Date.now();
  const pollInterval = 500; // Check every 500ms

  while (Date.now() - startTime < timeout) {
    const workerState = await extensionWorker.evaluate(() => {
      // In service worker context, use globalThis which has ServiceWorkerGlobalScope
      return {
        readyState: (globalThis as any).registration?.active?.state,
        hasChrome: typeof chrome !== 'undefined',
        hasChromeCommands: typeof chrome?.commands !== 'undefined',
        location: (globalThis as any).location.href,
      };
    });

    // If chrome.commands is available, we're ready
    if (workerState.hasChromeCommands) {
      // Service worker ready with Chrome APIs
      return extensionWorker;
    }

    // Chrome APIs not ready yet, wait and retry
    console.log('Chrome APIs not ready, waiting...');
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    // Get fresh service worker reference in case it was restarted
    const freshWorkers = context.serviceWorkers();
    const freshWorker = freshWorkers.find(sw =>
      sw.url().startsWith('chrome-extension://'),
    );

    if (freshWorker) {
      extensionWorker = freshWorker;
    }
  }

  throw new Error(`Service worker Chrome APIs not ready after ${timeout}ms`);
}

/**
 * Wait for a specific time (helper to make timeouts more readable)
 */
export async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Grant optional permissions to the extension
 * This requests permissions programmatically without user interaction
 */
export async function grantOptionalPermissions(
  page: Page,
  permissions: string[],
): Promise<boolean> {
  try {
    // Request permissions using Chrome API
    const granted = await page.evaluate(async (perms) => {
      // Check if already granted
      const hasPermissions = await chrome.permissions.contains({ permissions: perms });
      if (hasPermissions) {
        return true;
      }

      // Request permissions
      // Note: In test environment, this should grant automatically
      return await chrome.permissions.request({ permissions: perms });
    }, permissions);

    console.log(`Permissions ${permissions.join(', ')} granted:`, granted);
    return granted;
  } catch (error) {
    console.error('Failed to grant permissions:', error);
    return false;
  }
}
