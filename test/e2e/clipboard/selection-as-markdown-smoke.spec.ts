import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ConsoleMessage, Worker } from '@playwright/test';
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

  test('copies markdown through iframe fallback without page message interference', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (message: ConsoleMessage) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    await page.goto('http://localhost:5566/selection-noisy.html');
    await page.waitForLoadState('networkidle');

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

    await serviceWorker.evaluate(() => {
      // @ts-expect-error - Chrome APIs are available in extension workers
      return chrome.commands.onCommand.dispatch('selection-as-markdown');
    });

    await page.bringToFront();
    const clipboardText = normalizeLineEndings(await waitForSystemClipboard(5000));
    const expectedMarkdown = await readFile(join(__dirname, '../../../fixtures/selection-noisy.md'), 'utf-8');

    expect(clipboardText).toEqual(normalizeLineEndings(expectedMarkdown));
    expect(consoleErrors).toEqual(expect.not.arrayContaining([expect.stringContaining('Message origin not allowed')]));
  });
});
