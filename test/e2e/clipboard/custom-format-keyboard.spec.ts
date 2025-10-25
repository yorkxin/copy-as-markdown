/**
 * E2E tests for Custom Format Keyboard Shortcuts
 *
 * Tests that custom formats can be configured via the UI and then used
 * through keyboard shortcuts. This tests the full integration between
 * the custom format UI, storage, and keyboard command handling.
 *
 * NOTE: These tests use the system clipboard and run serially via project config
 */

import { expect, test } from '../fixtures';
import { getServiceWorker, resetClipboard, waitForClipboard } from '../helpers';

/**
 * Configure a custom format using the web UI
 * This simulates the user experience of setting up a custom format
 */
async function configureCustomFormatViaUI(
  page: any,
  extensionId: string,
  options: {
    slot: string;
    context: 'single-link' | 'multiple-links';
    name: string;
    template: string;
    showInMenus: boolean;
  },
) {
  const { slot, context, name, template, showInMenus } = options;

  // Navigate to custom format page
  const customFormatUrl = `chrome-extension://${extensionId}/dist/static/custom-format.html?slot=${slot}&context=${context}`;
  await page.goto(customFormatUrl);
  await page.waitForLoadState('networkidle');

  // Fill in the form
  const nameInput = page.locator('#input-name');
  const templateInput = page.locator('#input-template');
  const showInMenusCheckbox = page.locator('#input-show-in-menus');
  const saveButton = page.locator('#save');

  // Clear and fill name (using clear first to remove any default value)
  await nameInput.clear();
  await nameInput.fill(name);

  // Fill template
  await templateInput.clear();
  await templateInput.fill(template);

  // Set checkbox
  if (showInMenus) {
    await showInMenusCheckbox.check();
  } else {
    await showInMenusCheckbox.uncheck();
  }

  // Wait for preview to update
  await page.waitForTimeout(200);

  // Save the configuration
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  // Wait for save to complete
  await page.waitForTimeout(500);
}

test.describe('Custom Format Keyboard Shortcuts', () => {
  test.afterEach(async ({ }) => {
    await resetClipboard();
  });
  test.describe('Current Tab - Single Link', () => {
    test('should use custom format 1 with keyboard shortcut', async ({ page, context, extensionId }) => {
      // Configure custom format 1 for single links via UI
      await configureCustomFormatViaUI(page, extensionId, {
        slot: '1',
        context: 'single-link',
        name: 'Bracket Link',
        template: '{{title}} <{{url}}>',
        showInMenus: true,
      });

      // Navigate to test page
      await page.goto('http://localhost:5566/qa.html');
      await page.waitForLoadState('networkidle');

      // Trigger the custom format keyboard command
      const serviceWorker = await getServiceWorker(context);
      await serviceWorker.evaluate(async () => {
        const currentTab = await chrome.tabs.getCurrent();
        // @ts-expect-error - Chrome APIs are available in service worker
        chrome.commands.onCommand.dispatch('current-tab-custom-format-1', currentTab);
      });

      // Wait for clipboard to be populated
      await page.bringToFront();
      const clipboardText = await waitForClipboard(5000);

      // Verify clipboard contains the custom format output
      expect(clipboardText).toEqual('[QA] \\*\\*Hello\\*\\* \\_World\\_ <http://localhost:5566/qa.html>');
    });

    test('should use custom format 2 with different template', async ({ page, context, extensionId }) => {
      // Configure custom format 2 for single links via UI
      await configureCustomFormatViaUI(page, extensionId, {
        slot: '2',
        context: 'single-link',
        name: 'Simple Format',
        template: '{{title}}: {{url}}',
        showInMenus: false,
      });

      // Navigate to test page
      await page.goto('http://localhost:5566/qa.html');
      await page.waitForLoadState('networkidle');

      // Trigger the custom format 2 keyboard command
      const serviceWorker = await getServiceWorker(context);
      await serviceWorker.evaluate(async () => {
        const currentTab = await chrome.tabs.getCurrent();
        // @ts-expect-error - Chrome APIs
        chrome.commands.onCommand.dispatch('current-tab-custom-format-2', currentTab);
      });

      // Wait for clipboard
      await page.bringToFront();
      const clipboardText = await waitForClipboard(5000);

      // Verify the custom format was applied
      expect(clipboardText).toEqual('[QA] \\*\\*Hello\\*\\* \\_World\\_: http://localhost:5566/qa.html');
    });
  });

  test.describe('All Tabs - Multiple Links', () => {
    test('should use custom format 1 for all tabs', async ({ page, context, extensionId }) => {
      // Configure custom format 1 for multiple links via UI
      await configureCustomFormatViaUI(page, extensionId, {
        slot: '1',
        context: 'multiple-links',
        name: 'Numbered Links',
        template: '{{#links}}{{number}}. {{title}} - {{url}}\n{{/links}}',
        showInMenus: true,
      });

      // Create multiple tabs
      await page.goto('http://localhost:5566/1.html');
      await page.waitForLoadState('networkidle');

      const page2 = await context.newPage();
      await page2.goto('http://localhost:5566/2.html');
      await page2.waitForLoadState('networkidle');

      const page3 = await context.newPage();
      await page3.goto('http://localhost:5566/3.html');
      await page3.waitForLoadState('networkidle');

      // Switch back to first page
      await page.bringToFront();

      // Trigger all-tabs custom format 1 command
      const serviceWorker = await getServiceWorker(context);
      await serviceWorker.evaluate(async () => {
        const currentTab = await chrome.tabs.getCurrent();
        // @ts-expect-error - Chrome APIs
        chrome.commands.onCommand.dispatch('all-tabs-custom-format-1', currentTab);
      });

      // Wait for clipboard
      await page.bringToFront();
      const clipboardText = await waitForClipboard(5000);

      // Verify output contains all tabs in numbered format
      expect(clipboardText).toContain('1. Page 1 - Copy as Markdown - http://localhost:5566/1.html');
      expect(clipboardText).toContain('2. Page 2 - Copy as Markdown - http://localhost:5566/2.html');
      expect(clipboardText).toContain('3. Page 3 - Copy as Markdown - http://localhost:5566/3.html');

      // Cleanup
      await page2.close();
      await page3.close();
    });

    test('should use custom format with grouped structure', async ({ page, context, extensionId }) => {
      // Configure custom format 3 for multiple links with groups via UI
      await configureCustomFormatViaUI(page, extensionId, {
        slot: '3',
        context: 'multiple-links',
        name: 'Grouped Format',
        template: '{{#grouped}}{{#isGroup}}## {{title}}\n{{#links}}- {{title}}\n{{/links}}{{/isGroup}}{{^isGroup}}- {{title}}\n{{/isGroup}}{{/grouped}}',
        showInMenus: true,
      });

      // Create a single tab for this test
      await page.goto('http://localhost:5566/1.html');
      await page.waitForLoadState('networkidle');

      // Trigger all-tabs custom format 3 command
      const serviceWorker = await getServiceWorker(context);
      await serviceWorker.evaluate(async () => {
        const currentTab = await chrome.tabs.getCurrent();
        // @ts-expect-error - Chrome APIs
        chrome.commands.onCommand.dispatch('all-tabs-custom-format-3', currentTab);
      });

      // Wait for clipboard
      await page.bringToFront();
      const clipboardText = await waitForClipboard(5000);

      // Verify output (single ungrouped tab)
      expect(clipboardText).toContain('- Page 1 - Copy as Markdown');
    });
  });

  test.describe('Highlighted Tabs - Multiple Links', () => {
    test('should use custom format 1 for highlighted tabs only', async ({ page, context, extensionId }) => {
      // Configure custom format 1 for multiple links via UI
      await configureCustomFormatViaUI(page, extensionId, {
        slot: '1',
        context: 'multiple-links',
        name: 'Bullet List',
        template: '{{#links}}- [{{title}}]({{url}})\n{{/links}}',
        showInMenus: true,
      });

      // Create multiple tabs
      await page.goto('http://localhost:5566/1.html');
      const page2 = await context.newPage();
      await page2.goto('http://localhost:5566/2.html');
      const page3 = await context.newPage();
      await page3.goto('http://localhost:5566/3.html');

      // Trigger highlighted-tabs custom format 1 command
      const serviceWorker = await getServiceWorker(context);
      await serviceWorker.evaluate(async () => {
        const [page2] = await chrome.tabs.query({ currentWindow: true, url: 'http://localhost:5566/2.html' });
        if (page2 === undefined) {
          throw new Error('page 2 does not exist');
        }
        const [page3] = await chrome.tabs.query({ currentWindow: true, url: 'http://localhost:5566/3.html' });
        if (page3 === undefined) {
          throw new Error('page 2 does not exist');
        }
        await chrome.tabs.update(page2.id!, { highlighted: true });
        await chrome.tabs.update(page3.id!, { highlighted: true });
        const currentTab = await chrome.tabs.getCurrent();
        // @ts-expect-error - Chrome APIs
        chrome.commands.onCommand.dispatch('highlighted-tabs-custom-format-1', currentTab);
      });

      // Wait for clipboard
      await page.bringToFront();
      const clipboardText = await waitForClipboard(5000);

      // Verify output contains only highlighted tabs (should be all 3 in this case)
      expect(clipboardText).toContain('- [Page 2 - Copy as Markdown](http://localhost:5566/2.html)');
      expect(clipboardText).toContain('- [Page 3 - Copy as Markdown](http://localhost:5566/3.html)');

      // Cleanup
      await page2.close();
      await page3.close();
    });
  });

  test.describe('Multiple Custom Formats', () => {
    test('should handle switching between different custom formats', async ({ page, context, extensionId }) => {
      // Configure custom format 1
      await configureCustomFormatViaUI(page, extensionId, {
        slot: '1',
        context: 'single-link',
        name: 'Format 1',
        template: 'FIRST: {{title}}',
        showInMenus: true,
      });

      // Configure custom format 2
      await configureCustomFormatViaUI(page, extensionId, {
        slot: '2',
        context: 'single-link',
        name: 'Format 2',
        template: 'SECOND: {{url}}',
        showInMenus: true,
      });

      // Navigate to test page
      await page.goto('http://localhost:5566/qa.html');
      await page.waitForLoadState('networkidle');

      // Test custom format 1
      await resetClipboard();
      const serviceWorker = await getServiceWorker(context);
      await serviceWorker.evaluate(async () => {
        const currentTab = await chrome.tabs.getCurrent();
        // @ts-expect-error - Chrome APIs
        chrome.commands.onCommand.dispatch('current-tab-custom-format-1', currentTab);
      });
      await page.bringToFront();
      let clipboardText = await waitForClipboard(5000);
      expect(clipboardText).toEqual('FIRST: [QA] \\*\\*Hello\\*\\* \\_World\\_');

      // Test custom format 2
      await resetClipboard();
      await serviceWorker.evaluate(async () => {
        const currentTab = await chrome.tabs.getCurrent();
        // @ts-expect-error - Chrome APIs
        chrome.commands.onCommand.dispatch('current-tab-custom-format-2', currentTab);
      });
      await page.bringToFront();
      clipboardText = await waitForClipboard(5000);
      expect(clipboardText).toEqual('SECOND: http://localhost:5566/qa.html');
    });
  });
});
