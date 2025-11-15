/**
 * E2E tests for Options Page - Clipboard Tests
 *
 * Tests that settings changes are reflected in export operations that use the clipboard.
 * These tests rely on the mock clipboard so they can run in parallel.
 */

import type { Worker } from '@playwright/test';
import { expect, test } from '../fixtures';
import { getServiceWorker, resetMockClipboard, waitForMockClipboard } from '../helpers';

test.describe('Options Page - Clipboard Tests', () => {
  let serviceWorker: Worker;

  test.beforeEach(async ({ context }) => {
    serviceWorker = await getServiceWorker(context);
    await resetMockClipboard(serviceWorker);
  });

  test.describe('Unordered List Character Setting', () => {
    test('should use dash character by default when exporting all tabs', async ({ page, extensionId, context }) => {
      // Navigate to test pages
      await page.goto('http://localhost:5566/0.html');
      await page.waitForLoadState('networkidle');

      const page2 = await context.newPage();
      await page2.goto('http://localhost:5566/1.html');
      await page2.waitForLoadState('networkidle');

      // Reset settings to default via options page
      const optionsUrl = `chrome-extension://${extensionId}/dist/static/options.html`;
      await page.goto(optionsUrl);
      await page.waitForLoadState('networkidle');

      const resetButton = page.locator('#reset');
      await resetButton.click();
      await page.waitForTimeout(500);

      // Export all tabs using service worker command
      await serviceWorker.evaluate(() => {
        // @ts-expect-error - dispatch is available in tests
        chrome.commands.onCommand.dispatch('all-tabs-link-as-list');
      });

      // Verify clipboard contains list with dashes
      const clipboardText = (await waitForMockClipboard(serviceWorker, 5000)).text;
      expect(clipboardText).toContain('- [');
      expect(clipboardText).not.toContain('* [');
      expect(clipboardText).not.toContain('+ [');

      await page2.close();
    });

    test('should use asterisk character when setting is changed', async ({ page, extensionId, context }) => {
      // Navigate to test pages
      await page.goto('http://localhost:5566/0.html');
      await page.waitForLoadState('networkidle');

      const page2 = await context.newPage();
      await page2.goto('http://localhost:5566/1.html');
      await page2.waitForLoadState('networkidle');

      // Change setting to asterisk via options page
      const optionsUrl = `chrome-extension://${extensionId}/dist/static/options.html`;
      await page.goto(optionsUrl);
      await page.waitForLoadState('networkidle');

      const asteriskRadio = page.locator('input[name="character"][value="asterisk"]');
      await asteriskRadio.check();
      await page.waitForTimeout(500);

      // Export all tabs using service worker command
      await serviceWorker.evaluate(() => {
        // @ts-expect-error - dispatch is available in tests
        chrome.commands.onCommand.dispatch('all-tabs-link-as-list');
      });

      // Verify clipboard contains list with asterisks
      const clipboardText = (await waitForMockClipboard(serviceWorker, 5000)).text;
      expect(clipboardText).toContain('* [');
      expect(clipboardText).not.toContain('- [');

      await page2.close();
    });

    test('should use plus character when setting is changed', async ({ page, extensionId, context }) => {
      // Navigate to test pages
      await page.goto('http://localhost:5566/0.html');
      await page.waitForLoadState('networkidle');

      const page2 = await context.newPage();
      await page2.goto('http://localhost:5566/1.html');
      await page2.waitForLoadState('networkidle');

      // Change setting to plus via options page
      const optionsUrl = `chrome-extension://${extensionId}/dist/static/options.html`;
      await page.goto(optionsUrl);
      await page.waitForLoadState('networkidle');

      const plusRadio = page.locator('input[name="character"][value="plus"]');
      await plusRadio.check();
      await page.waitForTimeout(500);

      // Export all tabs using service worker command
      await serviceWorker.evaluate(() => {
        // @ts-expect-error - dispatch is available in tests
        chrome.commands.onCommand.dispatch('all-tabs-link-as-list');
      });

      // Verify clipboard contains list with plus signs
      const clipboardText = (await waitForMockClipboard(serviceWorker, 5000)).text;
      expect(clipboardText).toContain('+ [');
      expect(clipboardText).not.toContain('- [');

      await page2.close();
    });
  });

  test.describe('Tab Group Indentation Setting', () => {
    test('should use spaces by default when exporting tabs with tab groups', async ({ page, extensionId, context }) => {
      // Navigate to test pages
      await page.goto('http://localhost:5566/0.html');
      await page.waitForLoadState('networkidle');

      const page2 = await context.newPage();
      await page2.goto('http://localhost:5566/1.html');
      await page2.waitForLoadState('networkidle');

      const page3 = await context.newPage();
      await page3.goto('http://localhost:5566/2.html');
      await page3.waitForLoadState('networkidle');

      // Create a tab group with tabs
      const groupId = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const tabIds = tabs.slice(0, 2).map(t => t.id).filter((id): id is number => id !== undefined);
        if (tabIds.length >= 2) {
          try {
            const groupId = await chrome.tabs.group({ tabIds });
            await chrome.tabGroups.update(groupId, { title: 'Test Group' });
            return groupId;
          } catch (error) {
            console.log('Tab groups not supported:', error);
            return null;
          }
        }
        return null;
      });

      // Skip test if tab groups not supported
      if (groupId === null) {
        console.log('Skipping test: tab groups not supported');
        await page2.close();
        await page3.close();
        return;
      }

      // Reset settings to default via options page
      const optionsUrl = `chrome-extension://${extensionId}/dist/static/options.html`;
      await page.goto(optionsUrl);
      await page.waitForLoadState('networkidle');

      const resetButton = page.locator('#reset');
      await resetButton.click();
      await page.waitForTimeout(500);

      // Export all tabs using service worker command
      await serviceWorker.evaluate(() => {
        // @ts-expect-error - dispatch is available in tests
        chrome.commands.onCommand.dispatch('all-tabs-link-as-list');
      });

      // Verify clipboard contains list with space indentation
      const clipboardText = (await waitForMockClipboard(serviceWorker, 5000)).text;
      // Check for 2-space indentation (default)
      expect(clipboardText).toMatch(/\n {2}- \[/); // Nested item with 2 spaces
      expect(clipboardText).not.toMatch(/\n\t- \[/); // Should not have tab indentation

      await page2.close();
      await page3.close();
    });

    test('should use tab character when setting is changed to tab', async ({ page, extensionId, context }) => {
      // Navigate to test pages
      await page.goto('http://localhost:5566/0.html');
      await page.waitForLoadState('networkidle');

      const page2 = await context.newPage();
      await page2.goto('http://localhost:5566/1.html');
      await page2.waitForLoadState('networkidle');

      const page3 = await context.newPage();
      await page3.goto('http://localhost:5566/2.html');
      await page3.waitForLoadState('networkidle');

      // Create a tab group with tabs
      const groupId = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const tabIds = tabs.slice(0, 2).map(t => t.id).filter((id): id is number => id !== undefined);
        if (tabIds.length >= 2) {
          try {
            const groupId = await chrome.tabs.group({ tabIds });
            await chrome.tabGroups.update(groupId, { title: 'Test Group' });
            return groupId;
          } catch (error) {
            console.log('Tab groups not supported:', error);
            return null;
          }
        }
        return null;
      });

      // Skip test if tab groups not supported
      if (groupId === null) {
        console.log('Skipping test: tab groups not supported');
        await page2.close();
        await page3.close();
        return;
      }

      // Change setting to tab indentation via options page
      const optionsUrl = `chrome-extension://${extensionId}/dist/static/options.html`;
      await page.goto(optionsUrl);
      await page.waitForLoadState('networkidle');

      const tabRadio = page.locator('input[name="indentation"][value="tab"]');
      await tabRadio.check();
      await page.waitForTimeout(500);

      // Export all tabs using service worker command
      await serviceWorker.evaluate(() => {
        // @ts-expect-error - dispatch is available in tests
        chrome.commands.onCommand.dispatch('all-tabs-link-as-list');
      });

      // Verify clipboard contains list with tab indentation
      const clipboardText = (await waitForMockClipboard(serviceWorker, 5000)).text;
      // Check for tab indentation
      expect(clipboardText).toMatch(/\n\t- \[/); // Nested item with tab character
      expect(clipboardText).not.toMatch(/\n {2}- \[/); // Should not have space indentation

      await page2.close();
      await page3.close();
    });
  });
});
