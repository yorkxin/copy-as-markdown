import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Worker } from '@playwright/test';
import { expect, test } from '../fixtures';
import {
  getServiceWorker,
  resetSystemClipboard,
  setMockClipboardMode,
  waitForSystemClipboard,
} from '../helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').trimEnd();
}

test.describe.configure({ mode: 'serial' });

test.describe('Selection As Markdown Clipboard Smoke', () => {
  let serviceWorker: Worker;

  test.beforeEach(async ({ context }) => {
    serviceWorker = await getServiceWorker(context);
    await setMockClipboardMode(serviceWorker, false);
    await context.clearPermissions();
  });

  test.beforeEach(async () => {
    await resetSystemClipboard();
  });

  test.afterEach(async () => {
    if (serviceWorker) {
      await setMockClipboardMode(serviceWorker, true);
    }
  });

  test.describe('on a noisy pages with post mesasages', async () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('http://localhost:5566/selection-noisy.html');
      await page.waitForLoadState('networkidle');

      // Foreground the tab before selecting so the selection is read from a
      // focused page (mirrors the real user flow and avoids a focus race that
      // can leave the selection unreadable under heavy parallel load).
      await page.bringToFront();

      await page.evaluate(() => {
        const range = document.createRange();
        const content = document.querySelector('#content');
        if (!content) {
          throw new Error('Missing #content');
        }
        range.selectNodeContents(content);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      });
    });

    test('copies current tab via context menu handler', async () => {
      await serviceWorker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });
        if (!tab) {
          throw new Error('No active tab found');
        }
        // @ts-expect-error - Chrome APIs are available in service worker
        chrome.contextMenus.onClicked.dispatch({
          menuItemId: 'selection-as-markdown',
        } as browser.contextMenus.OnClickData, tab);
      });

      const clipboardText = normalizeLineEndings(await waitForSystemClipboard(5000));
      const expectedMarkdown = await readFile(join(__dirname, '../../../fixtures/selection-noisy.md'), 'utf-8');

      expect(clipboardText).toEqual(normalizeLineEndings(expectedMarkdown));
    });

    test('copies markdown to the system clipboard', async () => {
      await serviceWorker.evaluate(() => {
        // @ts-expect-error - Chrome APIs are available in extension workers
        return chrome.commands.onCommand.dispatch('selection-as-markdown');
      });

      const clipboardText = normalizeLineEndings(await waitForSystemClipboard(5000));
      const expectedMarkdown = await readFile(join(__dirname, '../../../fixtures/selection-noisy.md'), 'utf-8');

      expect(clipboardText).toEqual(normalizeLineEndings(expectedMarkdown));
    });
  });
});
