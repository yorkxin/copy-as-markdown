/**
 * Playwright test fixtures for Chrome extension testing
 *
 * Based on: https://playwright.dev/docs/chrome-extensions
 */

import { test as base, chromium } from '@playwright/test';
import type { BrowserContext, Worker } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getServiceWorker, setMockClipboardMode } from './helpers';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  extensionPath: string;
  serviceWorker: Worker;
}

export const test = base.extend<ExtensionFixtures>({
  extensionPath: [path.join(__dirname, '../../chrome-test'), { option: true }],

  context: async ({ extensionPath }, use) => {
    // Path to test-specific Chrome extension with tabs permission
    // This is built by scripts/build-test-extension.js

    // Launch persistent context with extension loaded
    // IMPORTANT: Extensions only work in Chromium with persistent context
    const context = await chromium.launchPersistentContext('', {
      headless: false, // Extensions require headed mode
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        // Disable some features that might interfere with testing
        '--disable-blink-features=AutomationControlled',
        // see https://issues.chromium.org/issues/404298968
        '--disable-features=GlobalShortcutsPortal',
      ],
    });

    // Grant clipboard permissions for all origins
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => {
    // Get or create a page from YOUR context
    let [page] = context.pages();
    if (!page) {
      page = await context.newPage();
    }
    await use(page);
    // Don't close it here - it will be closed with context
  },
  // Extract extension ID from service worker URL
  extensionId: async ({ context }, use) => {
    // For Manifest V3, get the service worker
    let [serviceWorker] = context.serviceWorkers();

    // If not available yet, wait for it
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }

    // The service worker URL is: chrome-extension://<extensionId>/dist/background.js
    // Extract the extension ID from the URL
    const extensionId = serviceWorker.url().split('/')[2];

    await use(extensionId);
  },
  serviceWorker: async ({ context }, use) => {
    const worker = await getServiceWorker(context);
    await setMockClipboardMode(worker, true);
    await use(worker);
  },
});

export { expect } from '@playwright/test';
