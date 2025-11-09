/**
 * E2E tests for Custom Format Keyboard Shortcuts
 *
 * Tests that custom formats can be configured via the UI and then used
 * through keyboard shortcuts. This tests the full integration between
 * the custom format UI, storage, and keyboard command handling.
 *
 * NOTE: These tests use the system clipboard and run serially via project config
 */

import type { Page } from '@playwright/test';
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

  // Save the configuration
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  // Wait for save to complete
  await page.waitForTimeout(500);
}

test.describe('Custom Format', () => {
  test.beforeEach(async ({ }) => {
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

  test.describe('multiple links', () => {
    let page2: Page;
    let page3: Page;
    let page4: Page;

    const TEMPLATE_FLAT = '{{#links}}{{number}}. {{title}} - {{url}}\n{{/links}}';
    const TEMPLATE_WITH_GROUP = '{{#grouped}}{{#isGroup}}- {{title}}\n{{#links}}  - {{title}}\n{{/links}}{{/isGroup}}{{^isGroup}}- {{title}}\n{{/isGroup}}{{/grouped}}';

    test.beforeEach(async ({ page, context }) => {
      // Create multiple tabs
      await page.goto('http://localhost:5566/1.html');

      page2 = await context.newPage();
      await page2.goto('http://localhost:5566/2.html');

      page3 = await context.newPage();
      await page3.goto('http://localhost:5566/3.html');

      page4 = await context.newPage();
      await page4.goto('http://localhost:5566/4.html');
    });

    test.afterEach(async () => {
      // Cleanup
      await page2.close();
      await page3.close();
      await page4.close();
    });

    [
      {
        name: 'all tabs, template does not use group, tabs are not grouped',
        tabsAreGrouped: false,
        tabsAreHighlighted: false,
        setTemplate: TEMPLATE_FLAT,
        commandName: 'all-tabs-custom-format-1',
        expected: `1. Page 1 - Copy as Markdown - http://localhost:5566/1.html
2. Page 2 - Copy as Markdown - http://localhost:5566/2.html
3. Page 3 - Copy as Markdown - http://localhost:5566/3.html
4. Page 4 - Copy as Markdown - http://localhost:5566/4.html
`,
      },
      {
        name: 'all tabs, template does not use group, tabs are grouped',
        tabsAreGrouped: true,
        tabsAreHighlighted: false,
        setTemplate: TEMPLATE_FLAT,
        commandName: 'all-tabs-custom-format-1',
        expected: `1. Page 1 - Copy as Markdown - http://localhost:5566/1.html
2. Page 2 - Copy as Markdown - http://localhost:5566/2.html
3. Page 3 - Copy as Markdown - http://localhost:5566/3.html
4. Page 4 - Copy as Markdown - http://localhost:5566/4.html
`,
      },
      {
        name: 'all tabs, template uses group, tabs are grouped',
        tabsAreGrouped: true,
        tabsAreHighlighted: false,
        setTemplate: TEMPLATE_WITH_GROUP,
        commandName: 'all-tabs-custom-format-1',
        expected:
          `- Group 1
  - Page 1 - Copy as Markdown
  - Page 2 - Copy as Markdown
- Page 3 - Copy as Markdown
- Untitled blue group
  - Page 4 - Copy as Markdown
`,
      },
      {
        name: 'all tabs, template uses group, tabs are not grouped',
        tabsAreGrouped: false,
        tabsAreHighlighted: false,
        setTemplate: TEMPLATE_WITH_GROUP,
        commandName: 'all-tabs-custom-format-1',
        expected:
          `- Page 1 - Copy as Markdown
- Page 2 - Copy as Markdown
- Page 3 - Copy as Markdown
- Page 4 - Copy as Markdown
`,
      },
      {
        name: 'highlighted tabs, template does not use group, tabs are not grouped',
        tabsAreGrouped: false,
        tabsAreHighlighted: true,
        setTemplate: TEMPLATE_FLAT,
        commandName: 'highlighted-tabs-custom-format-1',
        expected: `1. Page 1 - Copy as Markdown - http://localhost:5566/1.html
2. Page 3 - Copy as Markdown - http://localhost:5566/3.html
`,
      },
      {
        name: 'highlighted tabs, template does not use group, tabs are grouped',
        tabsAreGrouped: true,
        tabsAreHighlighted: true,
        setTemplate: TEMPLATE_FLAT,
        commandName: 'highlighted-tabs-custom-format-1',
        expected: `1. Page 1 - Copy as Markdown - http://localhost:5566/1.html
2. Page 3 - Copy as Markdown - http://localhost:5566/3.html
`,
      },
      {
        name: 'highlighted tabs, template uses group, tabs are grouped',
        tabsAreGrouped: true,
        tabsAreHighlighted: true,
        setTemplate: TEMPLATE_WITH_GROUP,
        commandName: 'highlighted-tabs-custom-format-1',
        expected:
          `- Group 1
  - Page 1 - Copy as Markdown
- Page 3 - Copy as Markdown
`,
      },
      {
        name: 'highlighted tabs, template uses group, tabs are not grouped',
        tabsAreGrouped: false,
        tabsAreHighlighted: true,
        setTemplate: TEMPLATE_WITH_GROUP,
        commandName: 'highlighted-tabs-custom-format-1',
        expected:
          `- Page 1 - Copy as Markdown
- Page 3 - Copy as Markdown
`,
      },
    ].forEach(({ name, tabsAreGrouped, tabsAreHighlighted, setTemplate, commandName, expected }) => {
      test.describe(`should work with ${name}`, async () => {
        test.beforeEach(async ({ context, extensionId, page }) => {
          const optionsPage = await context.newPage();
          await configureCustomFormatViaUI(optionsPage, extensionId, {
            slot: '1',
            context: 'multiple-links',
            name: 'Custom Template in Test',
            template: setTemplate,
            showInMenus: true,
          });
          await optionsPage.close();

          // Switch back to first page
          await page.bringToFront();

          const serviceWorker = await getServiceWorker(context);
          await serviceWorker.evaluate(async ({ tabsAreGrouped, tabsAreHighlighted }) => {
            const allTabs = await chrome.tabs.query({ currentWindow: true });
            // Find tabs by URL
            const tab1 = allTabs.find(tab => tab.url === 'http://localhost:5566/1.html');
            const tab2 = allTabs.find(tab => tab.url === 'http://localhost:5566/2.html');
            const tab3 = allTabs.find(tab => tab.url === 'http://localhost:5566/3.html');
            const tab4 = allTabs.find(tab => tab.url === 'http://localhost:5566/4.html');

            if (!tab1 || !tab2 || !tab3 || !tab4) {
              throw new Error('Could not find all tabs');
            }

            if (tabsAreGrouped) {
              // Create first group with tabs 1 and 2
              const group1Id = await chrome.tabs.group({
                tabIds: [tab1.id!, tab2.id!],
              });
              await chrome.tabGroups.update(group1Id, {
                title: 'Group 1',
                collapsed: false,
              });

              // Create second group with tab 4 only
              const group2Id = await chrome.tabs.group({
                tabIds: [tab4.id!],
              });
              await chrome.tabGroups.update(group2Id, {
                color: 'blue',
                collapsed: false,
              });
            }

            if (tabsAreHighlighted) {
              await chrome.tabs.update(tab1.id!, { highlighted: true });
              await chrome.tabs.update(tab3.id!, { highlighted: true });
            }
          }, { tabsAreGrouped, tabsAreHighlighted });
        });

        test('works with keyboard command', async ({ context, page }) => {
          const serviceWorker = await getServiceWorker(context);
          await serviceWorker.evaluate(async (commandName) => {
            const currentTab = await chrome.tabs.getCurrent();
            // @ts-expect-error - Chrome APIs
            chrome.commands.onCommand.dispatch(commandName, currentTab);
          }, commandName);

          // Wait for clipboard
          await page.bringToFront();
          const clipboardText = await waitForClipboard(5000);

          // Verify output contains all tabs in numbered format
          expect(clipboardText).toEqual(expected);
        });

        test('works with popup', async ({ context, page }) => {
          // get window id from the current page's tab
          const serviceWorker = await getServiceWorker(context);

          await serviceWorker.evaluate(async () => {
            const tabs = await chrome.tabs.query({ currentWindow: true, active: true });
            if (!tabs[0]) {
              throw new Error('No active tab found');
            }
            const windowId = tabs[0].windowId;

            // Open popup in a new window (not a new tab in the same window)
            const popupUrl = `${chrome.runtime.getURL('/dist/static/popup.html')}?window=${windowId}`;

            // Create a new window with the popup
            await chrome.windows.create({
              url: popupUrl,
              type: 'popup',
              width: 400,
              height: 600,
            });
          });

          // Wait for the new window and get its page
          const popupWindow = await context.waitForEvent('page');
          await popupWindow.waitForLoadState('networkidle');

          // Click the button with id = commandName
          const button = popupWindow.locator(`#${commandName}`);
          await expect(button).toBeVisible();
          await button.click();

          // Wait for clipboard
          await page.bringToFront();
          const clipboardText = await waitForClipboard(5000);

          // Verify output
          expect(clipboardText).toEqual(expected);

          // Cleanup
          await popupWindow.close();
        });
      });
    });
  });
});
