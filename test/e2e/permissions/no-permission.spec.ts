import type { BrowserContext, Page, Worker } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '../fixtures';
import {
  enableMockPermissions,
  ensureCustomFormatsVisible,
  getMockClipboardCalls,
  removeOptionalPermissions,
  resetMockClipboard,
} from '../helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OPTIONAL_EXTENSION_PATH = path.join(__dirname, '../../../chrome-optional-test');
const PERMISSION_URL_SUBSTRING = '/dist/static/permissions.html';

const TAB_EXPORT_COMMANDS = [
  'all-tabs-link-as-list',
  'all-tabs-link-as-task-list',
  'all-tabs-title-as-list',
  'all-tabs-url-as-list',
  'all-tabs-custom-format-1',
  'highlighted-tabs-link-as-list',
  'highlighted-tabs-link-as-task-list',
  'highlighted-tabs-title-as-list',
  'highlighted-tabs-url-as-list',
  'highlighted-tabs-custom-format-1',
];

test.describe('Tab export permission prompts', () => {
  test.use({ extensionPath: OPTIONAL_EXTENSION_PATH });
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page, serviceWorker }) => {
    await enableMockPermissions(serviceWorker);
    await removeOptionalPermissions(serviceWorker, ['tabs', 'tabGroups']);
    await resetMockClipboard(serviceWorker);
    await ensureCustomFormatsVisible(serviceWorker, 'multiple-links', ['1']);

    await page.goto('http://localhost:5566/qa.html');
    await page.waitForLoadState('networkidle');
  });

  for (const commandName of TAB_EXPORT_COMMANDS) {
    test(`keyboard shortcut opens permission page when running ${commandName}`, async ({ context, serviceWorker }) => {
      const permissionPagePromise = waitForPermissionPage(context);

      await serviceWorker.evaluate(async (command) => {
        const [activeTab] = await chrome.tabs.query({ currentWindow: true, active: true });
        // @ts-expect-error - Chrome APIs are available in service worker
        await chrome.commands.onCommand.dispatch(command, activeTab);
      }, commandName);

      const permissionPage = await permissionPagePromise;
      await assertPermissionPage(permissionPage);
      await expectNoClipboardWrites(serviceWorker);
      await permissionPage.close();
    });
  }

  for (const commandName of TAB_EXPORT_COMMANDS) {
    test(`popup action opens permission page when clicking ${commandName}`, async ({ context, extensionId, serviceWorker }) => {
      const popupWindow = await openPopupWindow(context, serviceWorker, extensionId);
      try {
        const permissionPagePromise = waitForPermissionPage(context, popupWindow);

        const actionButton = popupWindow.locator(`#${commandName}`);
        await expect(actionButton).toBeVisible();
        await actionButton.click();

        const permissionPage = await permissionPagePromise;
        await assertPermissionPage(permissionPage);
        await expectNoClipboardWrites(serviceWorker);
        await permissionPage.close();
      } finally {
        await popupWindow.close();
      }
    });
  }
});

async function openPopupWindow(context: BrowserContext, serviceWorker: Worker, extensionId: string): Promise<Page> {
  const popupPromise = context.waitForEvent('page', { timeout: 5000 });

  await serviceWorker.evaluate(async (id) => {
    const tabs = await chrome.tabs.query({ currentWindow: true, active: true });
    const currentTab = tabs[0];
    if (!currentTab?.windowId) {
      throw new Error('No active tab or window id found');
    }

    const popupUrl = `chrome-extension://${id}/dist/static/popup.html?window=${currentTab.windowId}`;
    await chrome.windows.create({
      url: popupUrl,
      type: 'popup',
      width: 400,
      height: 600,
    });
  }, extensionId);

  const popupWindow = await popupPromise;
  await popupWindow.waitForLoadState('networkidle');
  return popupWindow;
}

async function waitForPermissionPage(context: BrowserContext, pageToIgnore?: Page): Promise<Page> {
  const permissionPage = await context.waitForEvent('page', {
    timeout: 5000,
    predicate: newPage => newPage !== pageToIgnore,
  });
  await permissionPage.waitForLoadState('domcontentloaded');
  await permissionPage.waitForURL(url => url.toString().includes(PERMISSION_URL_SUBSTRING), { timeout: 5000 });
  return permissionPage;
}

async function assertPermissionPage(page: Page): Promise<void> {
  await expect(page.locator('#request-permission')).toBeVisible();
}

async function expectNoClipboardWrites(serviceWorker: Worker): Promise<void> {
  const calls = await getMockClipboardCalls(serviceWorker);
  expect(calls.length).toBe(0);
}
