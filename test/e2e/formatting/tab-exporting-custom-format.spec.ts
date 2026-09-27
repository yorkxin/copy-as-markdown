// Mock clipboard isolation lets these integration cases run in parallel.

import type { Page, Worker } from '@playwright/test';
import { expect, test } from '../fixtures';
import {
  getMockClipboardCalls,
  getServiceWorker,
  resetMockClipboard,
  triggerContextMenu,
  waitForMockClipboard,
} from '../helpers';

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

  const customFormatUrl = `chrome-extension://${extensionId}/dist/static/custom-format.html?slot=${slot}&context=${context}`;
  await page.goto(customFormatUrl);
  await page.waitForLoadState('networkidle');

  const nameInput = page.locator('#input-name');
  const templateInput = page.locator('#input-template');
  const showInMenusCheckbox = page.locator('#input-show-in-menus');
  const saveButton = page.locator('#save');

  await nameInput.clear();
  await nameInput.fill(name);

  await templateInput.clear();
  await templateInput.fill(template);

  if (showInMenus) {
    await showInMenusCheckbox.check();
  } else {
    await showInMenusCheckbox.uncheck();
  }

  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  await page.waitForTimeout(500);
}

async function openPopupWindow(serviceWorker: Worker, context: any, extensionId: string) {
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
  return popupWindow;
}

test.describe('Custom Format', () => {
  let serviceWorker: Worker;

  test.beforeEach(async ({ context }) => {
    serviceWorker = await getServiceWorker(context);
    await resetMockClipboard(serviceWorker);
  });

  test.describe('Current Tab - Single Link', () => {
    test.beforeEach(async ({ page, extensionId }) => {
      await configureCustomFormatViaUI(page, extensionId, {
        slot: '1',
        context: 'single-link',
        name: 'Bracket Link',
        template: '{{title}} <{{url}}>',
        showInMenus: true,
      });

      await page.goto('http://localhost:5566/qa.html');
      await page.waitForLoadState('networkidle');
    });

    test('should work with keyboard shortcut', async ({ page }) => {
      await serviceWorker.evaluate(async () => {
        const currentTab = await chrome.tabs.getCurrent();
        // @ts-expect-error - Chrome APIs are available in service worker
        chrome.commands.onCommand.dispatch('current-tab-custom-format-1', currentTab);
      });

      await page.bringToFront();
      const clipboardText = (await waitForMockClipboard(serviceWorker, 5000)).text;

      expect(clipboardText).toEqual('[QA] \\*\\*Hello\\*\\* \\_World\\_ <http://localhost:5566/qa.html>');
    });

    test('should work with popup', async ({ page, context, extensionId }) => {
      const popupWindow = await openPopupWindow(serviceWorker, context, extensionId);

      const button = popupWindow.locator('#current-tab-custom-format-1');
      await expect(button).toBeVisible();
      await button.click();

      await page.bringToFront();
      const clipboardText = (await waitForMockClipboard(serviceWorker, 5000)).text;

      expect(clipboardText).toEqual('[QA] \\*\\*Hello\\*\\* \\_World\\_ <http://localhost:5566/qa.html>');

      await popupWindow.close();
    });

    test('shows deferred popup warning once when keyboard command renders empty output', async ({ page, context, extensionId }) => {
      await configureCustomFormatViaUI(page, extensionId, {
        slot: '1',
        context: 'single-link',
        name: 'Empty Link',
        template: '',
        showInMenus: true,
      });

      await page.goto('http://localhost:5566/qa.html');
      await page.waitForLoadState('networkidle');

      await serviceWorker.evaluate(async () => {
        // @ts-expect-error - Chrome APIs are available in service worker
        chrome.commands.onCommand.dispatch('current-tab-custom-format-1');
      });

      await expect.poll(async () => {
        return (await getMockClipboardCalls(serviceWorker)).length;
      }).toBe(0);

      const popupWindow = await openPopupWindow(serviceWorker, context, extensionId);
      await expect(popupWindow.getByText('Nothing to copy. The last command produced empty text.')).toBeVisible();
      await popupWindow.close();

      const popupWindowAgain = await openPopupWindow(serviceWorker, context, extensionId);
      await expect(popupWindowAgain.getByText('Nothing to copy. The last command produced empty text.')).toHaveCount(0);
      await popupWindowAgain.close();
    });
  });

  test.describe('multiple links', () => {
    let page2: Page;
    let page3: Page;
    let page4: Page;

    const TEMPLATE_FLAT = '{{#links}}{{number}}. {{title}} - {{url}}\n{{/links}}';
    const TEMPLATE_WITH_GROUP = '{{#grouped}}{{#isGroup}}- {{title}}\n{{#links}}  - {{title}}\n{{/links}}{{/isGroup}}{{^isGroup}}- {{title}}\n{{/isGroup}}{{/grouped}}';

    test.beforeEach(async ({ page, context }) => {
      await page.goto('http://localhost:5566/1.html');

      page2 = await context.newPage();
      await page2.goto('http://localhost:5566/2.html');

      page3 = await context.newPage();
      await page3.goto('http://localhost:5566/3.html');

      page4 = await context.newPage();
      await page4.goto('http://localhost:5566/4.html');
    });

    test.afterEach(async () => {
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

          await page.bringToFront();

          await serviceWorker.evaluate(async ({ tabsAreGrouped, tabsAreHighlighted }) => {
            const allTabs = await chrome.tabs.query({ currentWindow: true });
            const tab1 = allTabs.find(tab => tab.url === 'http://localhost:5566/1.html');
            const tab2 = allTabs.find(tab => tab.url === 'http://localhost:5566/2.html');
            const tab3 = allTabs.find(tab => tab.url === 'http://localhost:5566/3.html');
            const tab4 = allTabs.find(tab => tab.url === 'http://localhost:5566/4.html');

            if (!tab1 || !tab2 || !tab3 || !tab4) {
              throw new Error('Could not find all tabs');
            }

            if (tabsAreGrouped) {
              const group1Id = await chrome.tabs.group({
                tabIds: [tab1.id!, tab2.id!],
              });
              await chrome.tabGroups.update(group1Id, {
                title: 'Group 1',
                collapsed: false,
              });

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

              // chrome.tabs.update resolves before queries observe highlight changes.
              // Poll the same query used by export to avoid a Docker timing race.
              const deadline = Date.now() + 5000;
              for (;;) {
                const highlighted = await chrome.tabs.query({ highlighted: true, currentWindow: true });
                const ids = new Set(highlighted.map(t => t.id));
                if (ids.has(tab1.id!) && ids.has(tab3.id!)) {
                  break;
                }
                if (Date.now() > deadline) {
                  throw new Error(`highlighted tabs did not settle: got [${[...ids].join(', ')}], want ${tab1.id}, ${tab3.id}`);
                }
                await new Promise(resolve => setTimeout(resolve, 20));
              }
            }
          }, { tabsAreGrouped, tabsAreHighlighted });
        });

        test('works with keyboard command', async () => {
          await serviceWorker.evaluate(async (commandName) => {
            const tabs = await chrome.tabs.query({ currentWindow: true, active: true });
            if (!tabs[0]) {
              throw new Error('No active tab found');
            }
            // @ts-expect-error - Chrome APIs
            chrome.commands.onCommand.dispatch(commandName, tabs[0]);
          }, commandName);

          // Bringing the page forward collapses the multi-tab highlight before export reads it.
          const clipboardText = (await waitForMockClipboard(serviceWorker, 5000)).text;

          expect(clipboardText).toEqual(expected);
        });

        test('works with context menu', async () => {
          await triggerContextMenu(serviceWorker, commandName);

          // Keeping the page in the background preserves the multi-tab highlight.
          const clipboardText = (await waitForMockClipboard(serviceWorker, 5000)).text;
          expect(clipboardText).toEqual(expected);
        });

        test('works with popup', async ({ context }) => {
          await serviceWorker.evaluate(async () => {
            const tabs = await chrome.tabs.query({ currentWindow: true, active: true });
            if (!tabs[0]) {
              throw new Error('No active tab found');
            }
            const windowId = tabs[0].windowId;

            const popupUrl = `${chrome.runtime.getURL('/dist/static/popup.html')}?window=${windowId}`;

            await chrome.windows.create({
              url: popupUrl,
              type: 'popup',
              width: 400,
              height: 600,
            });
          });

          const popupWindow = await context.waitForEvent('page');
          await popupWindow.waitForLoadState('networkidle');

          const button = popupWindow.locator(`#${commandName}`);
          await expect(button).toBeVisible();
          await button.click();

          // No page.bringToFront() — activating a tab would collapse the highlight
          // selection before the popup-triggered export reads it (Docker-flaky).
          const clipboardText = (await waitForMockClipboard(serviceWorker, 5000)).text;

          expect(clipboardText).toEqual(expected);

          await popupWindow.close();
        });
      });
    });
  });
});
