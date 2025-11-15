/**
 * Playwright test fixtures for Chrome extension testing
 *
 * Based on: https://playwright.dev/docs/chrome-extensions
 */

import { test as base, chromium, firefox } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { withExtension } from 'playwright-webextext';
import { connectWithMaxRetries, findFreeTcpPort } from 'playwright-webextext/dist/firefox_remote.js';
import { getServiceWorker, setFirefoxExtensionInfo, setMockClipboardMode } from './helpers';
import type { ExtensionWorker } from './helpers';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_CHROME_EXTENSION_PATH = path.join(__dirname, '../../chrome-test');
const DEFAULT_FIREFOX_EXTENSION_PATH = path.join(__dirname, '../../firefox-test');

interface ExtensionFixtures {
  context: BrowserContext;
  extensionBaseUrl: string;
  extensionId: string;
  extensionPath: string;
  firefoxDebugPort: number | null;
  serviceWorker: ExtensionWorker;
}

export const test = base.extend<ExtensionFixtures>({
  extensionPath: [
    async ({ browserName }, use) => {
      const defaultPath = browserName === 'firefox'
        ? DEFAULT_FIREFOX_EXTENSION_PATH
        : DEFAULT_CHROME_EXTENSION_PATH;
      await use(defaultPath);
    },
    { option: true },
  ],

  firefoxDebugPort: [
    async ({ browserName }, use) => {
      if (browserName !== 'firefox') {
        await use(null);
        return;
      }
      const port = await findFreeTcpPort();
      await use(port);
    },
    { auto: true },
  ],

  context: async ({ browserName, extensionPath, firefoxDebugPort }, use) => {
    if (browserName === 'firefox') {
      if (!firefoxDebugPort) {
        throw new Error('Firefox debugging port not initialized');
      }
      const firefoxWithExtension = withExtension(firefox, extensionPath);
      const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cam-firefox-profile-'));
      const context = await firefoxWithExtension.launchPersistentContext(userDataDir, {
        headless: false,
        args: ['--start-debugger-server', String(firefoxDebugPort)],
        firefoxUserPrefs: {
          'xpinstall.signatures.required': false,
          'extensions.installDistroAddons': false,
          'extensions.autoDisableScopes': 0,
          'extensions.enabledScopes': 15,
          'extensions.manifestV3.enabled': true,
        },
      });

      const info = await resolveFirefoxExtensionInfo(extensionPath, firefoxDebugPort);
      setFirefoxExtensionInfo(context, info);

      try {
        await use(context);
      } finally {
        await context.close();
        await fs.rm(userDataDir, { recursive: true, force: true });
      }
      return;
    }

    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--disable-blink-features=AutomationControlled',
        '--disable-features=GlobalShortcutsPortal',
      ],
    });

    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    try {
      await use(context);
    } finally {
      await context.close();
    }
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
  extensionId: async ({ serviceWorker }, use) => {
    const baseUrl = await getExtensionBaseUrl(serviceWorker);
    await use(extractExtensionIdFromUrl(baseUrl));
  },
  extensionBaseUrl: async ({ serviceWorker }, use) => {
    const baseUrl = await getExtensionBaseUrl(serviceWorker);
    await use(baseUrl);
  },
  serviceWorker: async ({ context }, use) => {
    const worker = await getServiceWorker(context);
    await setMockClipboardMode(worker, true);
    await use(worker);
  },
});

export { expect } from '@playwright/test';

function extractExtensionIdFromUrl(url: string): string {
  const match = url.match(/^[a-z-]+:\/\/([^/]+)/i);
  if (!match || !match[1]) {
    throw new Error(`Failed to extract extension ID from URL: ${url}`);
  }
  return match[1];
}

async function resolveFirefoxExtensionInfo(extensionPath: string, debuggingPort: number) {
  const manifestPath = path.join(extensionPath, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const bridgePagePath = 'bridge.html';
  const extensionName: string = manifest?.name ?? 'Copy as Markdown';
  const geckoId: string | undefined = manifest?.browser_specific_settings?.gecko?.id;
  const extensionFileUrl = pathToFileURL(extensionPath).href.replace(/\/$/, '');

  const remote = await connectWithMaxRetries({ port: debuggingPort });
  try {
    const response = await remote.client.request('listAddons');
    const addons: any[] = Array.isArray(response?.addons) ? response.addons : [];
    const targetAddon = addons.find((addon) => {
      if (geckoId && addon.id === geckoId) {
        return true;
      }
      if (addon.name === extensionName) {
        return true;
      }
      if (typeof addon.url === 'string' && addon.url.startsWith('file://')) {
        return addon.url.replace(/\/$/, '') === extensionFileUrl;
      }
      return false;
    });

    const manifestUrl = targetAddon?.manifestURL;
    if (typeof manifestUrl !== 'string') {
      throw new Error(`Could not determine manifest URL for "${extensionName}"`);
    }

    const baseUrl = manifestUrl.replace(/\/manifest\.json(?:\?.*)?$/, '');
    return {
      baseUrl,
      bridgePagePath,
    };
  } finally {
    remote.disconnect();
  }
}

async function getExtensionBaseUrl(serviceWorker: ExtensionWorker): Promise<string> {
  const baseUrl = await serviceWorker.evaluate(() => {
    const runtime = typeof browser !== 'undefined' ? browser.runtime : chrome.runtime;
    if (!runtime?.getURL) {
      throw new Error('runtime.getURL is not available');
    }
    return runtime.getURL('/');
  });
  return baseUrl.replace(/\/$/, '');
}
