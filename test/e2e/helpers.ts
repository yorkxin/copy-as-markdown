/**
 * Helper utilities for E2E tests
 */

import type { BrowserContext, Page } from '@playwright/test';

const CLIPBOARD_SEPARATOR = '=========== CLIPBOARD SEPARATOR ===========';

/**
 * Wait for clipboard content to be populated (with timeout)
 */
export async function waitForClipboard(page: Page, timeout = 3000): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );

    if (clipboardText && clipboardText !== CLIPBOARD_SEPARATOR) {
      return clipboardText;
    }

    // Wait a bit before checking again
    await page.waitForTimeout(100);
  }

  throw new Error(`Clipboard was empty after ${timeout}ms`);
}

/**
 * Clear clipboard content
 */
export async function resetClipboard(page: Page): Promise<void> {
  try {
    await page.evaluate(str => navigator.clipboard.writeText(str), CLIPBOARD_SEPARATOR);
  } catch (error) {
    // Clipboard API might not be available in some contexts
    // That's okay, we'll just skip clearing
    console.log('Could not clear clipboard:', error);
  }
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

  // Log for debugging
  console.log('Extension service worker URL:', extensionWorker.url());

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

    console.debug('Service Worker State:', workerState);

    // If chrome.commands is available, we're ready
    if (workerState.hasChromeCommands) {
      console.log('Service worker ready with Chrome APIs');
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
