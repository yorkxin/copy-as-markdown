/**
 * E2E tests for keyboard commands
 *
 * This file tests keyboard shortcuts by triggering them programmatically
 * and verifying the clipboard output. We test 3 different approaches to
 * see which one works best.
 *
 * NOTE: These tests use the system clipboard and run serially via project config
 */

import { expect, test } from '../fixtures';
import { getServiceWorker, resetClipboard, waitForClipboard } from '../helpers';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test.describe('Selection as Markdown', () => {
  test.beforeEach(async ({ page }) => {
    await resetClipboard();
    await page.goto('http://localhost:5566/selection.html');
  });

  test('should copy selection as markdown', async ({ page, context }) => {
    // Select some text using JavaScript
    await page.evaluate(() => {
      const range = document.createRange();
      const body = document.querySelector('body');
      if (body) {
        range.selectNodeContents(body);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    });

    // Trigger selection-as-markdown command
    const serviceWorker = await getServiceWorker(context);
    await serviceWorker.evaluate(() => {
      // @ts-expect-error - Chrome APIs
      return chrome.commands.onCommand.dispatch('selection-as-markdown');
    });

    // Wait for clipboard
    const clipboardText = await waitForClipboard(3000);

    // Should match the expected markdown output from the fixture
    const expectedMarkdown = await readFile(join(__dirname, '../../../fixtures/selection.md'), 'utf-8');
    expect(clipboardText).toBe(expectedMarkdown);
  });

  test.describe('Unordered List Character Setting', () => {
    test('should use dash character by default', async ({ page, context, extensionId }) => {
      // Reset settings to default via options page in a new page
      const optionsPage = await context.newPage();
      const optionsUrl = `chrome-extension://${extensionId}/dist/static/options.html`;
      await optionsPage.goto(optionsUrl);
      await optionsPage.waitForLoadState('networkidle');

      const resetButton = optionsPage.locator('#reset');
      await resetButton.click();
      await optionsPage.waitForTimeout(500);
      await optionsPage.close();

      // Page is already at test page from beforeEach
      await page.waitForLoadState('networkidle');

      // Select the #test-ul element
      await page.evaluate(() => {
        const range = document.createRange();
        const testUl = document.querySelector('#test-ul');
        if (testUl) {
          range.selectNodeContents(testUl);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      });

      // Trigger selection-as-markdown command
      const serviceWorker = await getServiceWorker(context);
      await serviceWorker.evaluate(() => {
        // @ts-expect-error - Chrome APIs
        return chrome.commands.onCommand.dispatch('selection-as-markdown');
      });

      // Wait for clipboard
      const clipboardText = await waitForClipboard(3000);

      // Should match the expected markdown output with dashes
      const expectedMarkdown = await readFile(join(__dirname, '../../../fixtures/selection-ul-dash.md'), 'utf-8');
      expect(clipboardText).toBe(expectedMarkdown);
    });

    test('should use asterisk character when setting is changed', async ({ page, context, extensionId }) => {
      // Change setting to asterisk via options page in a new page
      const optionsPage = await context.newPage();
      const optionsUrl = `chrome-extension://${extensionId}/dist/static/options.html`;
      await optionsPage.goto(optionsUrl);
      await optionsPage.waitForLoadState('networkidle');

      const asteriskRadio = optionsPage.locator('input[name="character"][value="asterisk"]');
      await asteriskRadio.check();
      await optionsPage.waitForTimeout(500);
      await optionsPage.close();

      // Page is already at test page from beforeEach
      await page.waitForLoadState('networkidle');

      // Select the #test-ul element
      await page.evaluate(() => {
        const range = document.createRange();
        const testUl = document.querySelector('#test-ul');
        if (testUl) {
          range.selectNodeContents(testUl);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      });

      // Trigger selection-as-markdown command
      const serviceWorker = await getServiceWorker(context);
      await serviceWorker.evaluate(() => {
        // @ts-expect-error - Chrome APIs
        return chrome.commands.onCommand.dispatch('selection-as-markdown');
      });

      // Wait for clipboard
      const clipboardText = await waitForClipboard(3000);

      // Should match the expected markdown output with asterisks
      const expectedMarkdown = await readFile(join(__dirname, '../../../fixtures/selection-ul-asterisk.md'), 'utf-8');
      expect(clipboardText).toBe(expectedMarkdown);
    });

    test('should use plus character when setting is changed', async ({ page, context, extensionId }) => {
      // Change setting to plus via options page in a new page
      const optionsPage = await context.newPage();
      const optionsUrl = `chrome-extension://${extensionId}/dist/static/options.html`;
      await optionsPage.goto(optionsUrl);
      await optionsPage.waitForLoadState('networkidle');

      const plusRadio = optionsPage.locator('input[name="character"][value="plus"]');
      await plusRadio.check();
      await optionsPage.waitForTimeout(500);
      await optionsPage.close();

      // Page is already at test page from beforeEach
      await page.waitForLoadState('networkidle');

      // Select the #test-ul element
      await page.evaluate(() => {
        const range = document.createRange();
        const testUl = document.querySelector('#test-ul');
        if (testUl) {
          range.selectNodeContents(testUl);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      });

      // Trigger selection-as-markdown command
      const serviceWorker = await getServiceWorker(context);
      await serviceWorker.evaluate(() => {
        // @ts-expect-error - Chrome APIs
        return chrome.commands.onCommand.dispatch('selection-as-markdown');
      });

      // Wait for clipboard
      const clipboardText = await waitForClipboard(3000);

      // Should match the expected markdown output with plus signs
      const expectedMarkdown = await readFile(join(__dirname, '../../../fixtures/selection-ul-plus.md'), 'utf-8');
      expect(clipboardText).toBe(expectedMarkdown);
    });
  });
});
