// Playwright extension setup:
// https://playwright.dev/docs/chrome-extensions
import { test as base, chromium } from '@playwright/test';
import type { BrowserContext, Worker } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getServiceWorker, setMockClipboardMode } from './helpers';

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
    // scripts/build-test-extension.js produces this extension with test permissions.
    // Chromium extensions require a persistent, headed context.
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--disable-blink-features=AutomationControlled',
        // Chromium issue 404298968 can prevent extension shortcuts in Linux portals.
        // see https://issues.chromium.org/issues/404298968
        '--disable-features=GlobalShortcutsPortal',
      ],
    });

    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => {
    let [page] = context.pages();
    if (!page) {
      page = await context.newPage();
    }
    await use(page);
    // The owning context closes this shared page.
  },
  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();

    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }

    // chrome-extension://<id>/... places the extension ID at index 2.
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
