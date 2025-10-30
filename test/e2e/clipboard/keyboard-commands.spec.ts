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

test.describe('Keyboard Commands', () => {
  test.beforeEach(async ({ page }) => {
    await resetClipboard();
    await page.goto('http://localhost:5566/qa.html');
  });

  test('should copy current tab by directly calling command handler', async ({ page, context }) => {
    await page.goto('http://localhost:5566/qa.html');
    await page.waitForLoadState('networkidle');

    const serviceWorker = await getServiceWorker(context);
    await serviceWorker.evaluate(() => {
      // Fire the command event directly
      // @ts-expect-error - Chrome APIs are available in service worker
      chrome.commands.onCommand.dispatch('current-tab-link');
    });

    // Wait for clipboard to be populated
    const clipboardText = await waitForClipboard(5000);

    // Verify clipboard contains the expected format
    expect(clipboardText).toEqual('[[QA] \\*\\*Hello\\*\\* \\_World\\_](http://localhost:5566/qa.html)');
  });

  test('should handle all tabs export', async ({ page, context }) => {
    page.goto('http://localhost:5566/1.html');

    // Create multiple tabs
    const page2 = await context.newPage();
    await page2.goto('http://localhost:5566/2.html');

    const page3 = await context.newPage();
    await page3.goto('http://localhost:5566/3.html');

    // Switch back to first page
    await page.bringToFront();

    const serviceWorker = await getServiceWorker(context);

    await serviceWorker.evaluate(() => {
      // @ts-expect-error - Chrome APIs
      return chrome.commands.onCommand.dispatch('all-tabs-link-as-list');
    });

    const clipboardText = await waitForClipboard(5000);

    console.log('All Tabs Result:', clipboardText);

    // Should contain only highlighted tabs
    expect(clipboardText).toBeTruthy();
    expect(clipboardText).toContain('localhost:5566/1.html');
    expect(clipboardText).toContain('localhost:5566/2.html');
    expect(clipboardText).toContain('localhost:5566/3.html');
    expect(clipboardText).toMatch(/^- /m);

    // Cleanup
    await page2.close();
    await page3.close();
  });
});
