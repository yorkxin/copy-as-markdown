/**
 * Smoke tests that exercise the real system clipboard.
 * These run serially to avoid clipboard contention.
 */

import type { Worker } from '@playwright/test';
import { expect, test } from '../fixtures';
import {
  getServiceWorker,
  resetSystemClipboard,
  setMockClipboardMode,
  waitForSystemClipboard,
} from '../helpers';

const EXPECTED_LINK = '[[QA] \\*\\*Hello\\*\\* \\_World\\_](http://localhost:5566/qa.html)';

test.describe.configure({ mode: 'serial' });

test.describe('Clipboard Smoke Tests', () => {
  let serviceWorker: Worker;

  test.beforeEach(async ({ context, page }) => {
    serviceWorker = await getServiceWorker(context);
    await setMockClipboardMode(serviceWorker, false);
    await resetSystemClipboard();

    await page.goto('http://localhost:5566/qa.html');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    if (serviceWorker) {
      await setMockClipboardMode(serviceWorker, true);
    }
  });

  test('copies current tab via keyboard command', async ({ page }) => {
    await serviceWorker.evaluate(async () => {
      const currentTab = await chrome.tabs.getCurrent();
      // @ts-expect-error - Chrome APIs are available in service worker
      chrome.commands.onCommand.dispatch('current-tab-link', currentTab);
    });

    await page.bringToFront();
    const clipboardText = await waitForSystemClipboard(5000);
    expect(clipboardText).toEqual(EXPECTED_LINK);
  });

  test('copies current tab via context menu handler', async ({ page }) => {
    await serviceWorker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });
      if (!tab) {
        throw new Error('No active tab found');
      }
      // @ts-expect-error - Chrome APIs are available in service worker
      chrome.contextMenus.onClicked.dispatch({
        menuItemId: 'current-tab',
      } as browser.contextMenus.OnClickData, tab);
    });

    await page.bringToFront();
    const clipboardText = await waitForSystemClipboard(5000);
    expect(clipboardText).toEqual(EXPECTED_LINK);
  });

  test('copies current tab via popup UI', async ({ context, extensionId }) => {
    await serviceWorker.evaluate(async (extId) => {
      const tabs = await chrome.tabs.query({ currentWindow: true, active: true });
      if (!tabs[0]) {
        throw new Error('No active tab found');
      }
      const windowId = tabs[0].windowId;
      const popupUrl = `chrome-extension://${extId}/dist/static/popup.html?window=${windowId}`;

      await chrome.windows.create({
        url: popupUrl,
        type: 'popup',
        width: 400,
        height: 600,
      });
    }, extensionId);

    const popupWindow = await context.waitForEvent('page');
    await popupWindow.waitForLoadState('networkidle');

    const button = popupWindow.locator('#current-tab-link');
    await expect(button).toBeVisible();
    await button.click();

    const clipboardText = await waitForSystemClipboard(5000);
    expect(clipboardText).toEqual(EXPECTED_LINK);

    await popupWindow.close();
  });
});
