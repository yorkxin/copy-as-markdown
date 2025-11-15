/**
 * E2E tests for tabs exporting
 *
 * NOTE: These tests use a mock clipboard service for parallelization
 */

import type { Page, Worker } from '@playwright/test';
import { expect, test } from '../fixtures';
import { getServiceWorker, resetMockClipboard, waitForMockClipboard } from '../helpers';

test.describe('Tabs Exporting with built-in formats', () => {
  let serviceWorker: Worker;

  test.beforeEach(async ({ context }) => {
    serviceWorker = await getServiceWorker(context);
    await resetMockClipboard(serviceWorker);
  });

  test.describe('Current Tab - Single Link', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to test page
      await page.goto('http://localhost:5566/qa.html');
      await page.waitForLoadState('networkidle');
    });

    test('should work with keyboard shortcut', async ({ page }) => {
      // Trigger the custom format keyboard command
      await serviceWorker.evaluate(async () => {
        const currentTab = await chrome.tabs.getCurrent();
        // @ts-expect-error - Chrome APIs are available in service worker
        chrome.commands.onCommand.dispatch('current-tab-link', currentTab);
      });

      // Wait for mock clipboard to be populated
      await page.bringToFront();
      const mockCall = await waitForMockClipboard(serviceWorker, 5000);

      // Verify clipboard contains the Markdown link
      expect(mockCall.text).toEqual('[[QA] \\*\\*Hello\\*\\* \\_World\\_](http://localhost:5566/qa.html)');
    });

    test('should work with popup', async ({ page, context, extensionId }) => {
      // Get window id from the current page's tab
      await serviceWorker.evaluate(async (extensionId) => {
        const tabs = await chrome.tabs.query({ currentWindow: true, active: true });
        if (!tabs[0]) {
          throw new Error('No active tab found');
        }
        const windowId = tabs[0].windowId;

        // Open popup in a new window (not a new tab in the same window)
        const popupUrl = `chrome-extension://${extensionId}/dist/static/popup.html?window=${windowId}`;

        // Create a new window with the popup
        await chrome.windows.create({
          url: popupUrl,
          type: 'popup',
          width: 400,
          height: 600,
        });
      }, extensionId);

      // Wait for the new window and get its page
      const popupWindow = await context.waitForEvent('page');
      await popupWindow.waitForLoadState('networkidle');

      const button = popupWindow.locator('#current-tab-link');
      await expect(button).toBeVisible();
      await button.click();

      // Wait for mock clipboard
      await page.bringToFront();
      const mockCall = await waitForMockClipboard(serviceWorker, 5000);

      // Verify clipboard contains the Markdown link
      expect(mockCall.text).toEqual('[[QA] \\*\\*Hello\\*\\* \\_World\\_](http://localhost:5566/qa.html)');

      // Cleanup
      await popupWindow.close();
    });
  });

  test.describe('multiple links', () => {
    let page2: Page;
    let page3: Page;
    let page4: Page;

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
        name: 'all tabs as link, tabs are not grouped',
        tabsAreGrouped: false,
        tabsAreHighlighted: false,
        commandName: 'all-tabs-link-as-list',
        expected: `- [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
- [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
- [Page 3 - Copy as Markdown](http://localhost:5566/3.html)
- [Page 4 - Copy as Markdown](http://localhost:5566/4.html)`,
      },
      {
        name: 'all tabs as link, tabs are grouped',
        tabsAreGrouped: true,
        tabsAreHighlighted: false,
        commandName: 'all-tabs-link-as-list',
        expected: `- Group 1
  - [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
  - [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
- [Page 3 - Copy as Markdown](http://localhost:5566/3.html)
- Untitled blue group
  - [Page 4 - Copy as Markdown](http://localhost:5566/4.html)`,
      },
      {
        name: 'highlighted tabs as link, tabs are not grouped',
        tabsAreGrouped: false,
        tabsAreHighlighted: true,
        commandName: 'highlighted-tabs-link-as-list',
        expected: `- [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
- [Page 3 - Copy as Markdown](http://localhost:5566/3.html)`,
      },
      {
        name: 'highlighted tabs as link, tabs are grouped',
        tabsAreGrouped: true,
        tabsAreHighlighted: true,
        commandName: 'highlighted-tabs-link-as-list',
        expected: `- Group 1
  - [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
- [Page 3 - Copy as Markdown](http://localhost:5566/3.html)`,
      },
      {
        name: 'all tabs as task list, tabs are not grouped',
        tabsAreGrouped: false,
        tabsAreHighlighted: false,
        commandName: 'all-tabs-link-as-task-list',
        expected: `- [ ] [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
- [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
- [ ] [Page 3 - Copy as Markdown](http://localhost:5566/3.html)
- [ ] [Page 4 - Copy as Markdown](http://localhost:5566/4.html)`,
      },
      {
        name: 'all tabs as task list, tabs are grouped',
        tabsAreGrouped: true,
        tabsAreHighlighted: false,
        commandName: 'all-tabs-link-as-task-list',
        expected: `- [ ] Group 1
  - [ ] [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
  - [ ] [Page 2 - Copy as Markdown](http://localhost:5566/2.html)
- [ ] [Page 3 - Copy as Markdown](http://localhost:5566/3.html)
- [ ] Untitled blue group
  - [ ] [Page 4 - Copy as Markdown](http://localhost:5566/4.html)`,
      },
      {
        name: 'highlighted tabs as task list, tabs are not grouped',
        tabsAreGrouped: false,
        tabsAreHighlighted: true,
        commandName: 'highlighted-tabs-link-as-task-list',
        expected: `- [ ] [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
- [ ] [Page 3 - Copy as Markdown](http://localhost:5566/3.html)`,
      },
      {
        name: 'highlighted tabs as task list, tabs are grouped',
        tabsAreGrouped: true,
        tabsAreHighlighted: true,
        commandName: 'highlighted-tabs-link-as-task-list',
        expected: `- [ ] Group 1
  - [ ] [Page 1 - Copy as Markdown](http://localhost:5566/1.html)
- [ ] [Page 3 - Copy as Markdown](http://localhost:5566/3.html)`,
      },
      {
        name: 'all tabs as titlest, taas bs are not grouped',
        tabsAreGrouped: false,
        tabsAreHighlighted: false,
        commandName: 'all-tabs-title-as-list',
        expected: `- Page 1 - Copy as Markdown
- Page 2 - Copy as Markdown
- Page 3 - Copy as Markdown
- Page 4 - Copy as Markdown`,
      },
      {
        name: 'all tabs as titlest, taas bs are grouped',
        tabsAreGrouped: true,
        tabsAreHighlighted: false,
        commandName: 'all-tabs-title-as-list',
        expected: `- Group 1
  - Page 1 - Copy as Markdown
  - Page 2 - Copy as Markdown
- Page 3 - Copy as Markdown
- Untitled blue group
  - Page 4 - Copy as Markdown`,
      },
      {
        name: 'highlighted tabs title as list, tabs are not grouped',
        tabsAreGrouped: false,
        tabsAreHighlighted: true,
        commandName: 'highlighted-tabs-title-as-list',
        expected: `- Page 1 - Copy as Markdown
- Page 3 - Copy as Markdown`,
      },
      {
        name: 'highlighted tabs title as list, tabs are grouped',
        tabsAreGrouped: true,
        tabsAreHighlighted: true,
        commandName: 'highlighted-tabs-title-as-list',
        expected: `- Group 1
  - Page 1 - Copy as Markdown
- Page 3 - Copy as Markdown`,
      },
      {
        name: 'all tabs url as list, tabs are not grouped',
        tabsAreGrouped: false,
        tabsAreHighlighted: false,
        commandName: 'all-tabs-url-as-list',
        expected: `- http://localhost:5566/1.html
- http://localhost:5566/2.html
- http://localhost:5566/3.html
- http://localhost:5566/4.html`,
      },
      {
        name: 'all tabs url as list, tabs are grouped',
        tabsAreGrouped: true,
        tabsAreHighlighted: false,
        commandName: 'all-tabs-url-as-list',
        expected: `- Group 1
  - http://localhost:5566/1.html
  - http://localhost:5566/2.html
- http://localhost:5566/3.html
- Untitled blue group
  - http://localhost:5566/4.html`,
      },
      {
        name: 'highlighted tabs url as list, tabs are not grouped',
        tabsAreGrouped: false,
        tabsAreHighlighted: true,
        commandName: 'highlighted-tabs-url-as-list',
        expected: `- http://localhost:5566/1.html
- http://localhost:5566/3.html`,
      },
      {
        name: 'highlighted tabs url as list, tabs are grouped',
        tabsAreGrouped: true,
        tabsAreHighlighted: true,
        commandName: 'highlighted-tabs-url-as-list',
        expected: `- Group 1
  - http://localhost:5566/1.html
- http://localhost:5566/3.html`,
      },
    ].forEach(({ name, tabsAreGrouped, tabsAreHighlighted, commandName, expected }) => {
      test.describe(`should work with ${name}`, async () => {
        test.beforeEach(async ({ page }) => {
          // Switch back to first page
          await page.bringToFront();

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

        test('works with keyboard command', async ({ page }) => {
          await serviceWorker.evaluate(async (commandName) => {
            const tabs = await chrome.tabs.query({ currentWindow: true, active: true });
            if (!tabs[0]) {
              throw new Error('No active tab found');
            }
            // @ts-expect-error - Chrome APIs
            chrome.commands.onCommand.dispatch(commandName, tabs[0]);
          }, commandName);

          // Wait for mock clipboard
          await page.bringToFront();
          const mockCall = await waitForMockClipboard(serviceWorker, 5000);

          // Verify output contains all tabs in numbered format
          expect(mockCall.text).toEqual(expected);
        });

        test('works with popup', async ({ context }) => {
          // get window id from the current page's tab
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

          // Wait for mock clipboard
          const mockCall = await waitForMockClipboard(serviceWorker, 5000);

          // Verify output
          expect(mockCall.text).toEqual(expected);

          // Cleanup
          await popupWindow.close();
        });
      });
    });
  });
});
