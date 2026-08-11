/**
 * E2E tests for built-in style visibility toggles.
 *
 * These checkboxes live on the Menu Commands options page and control which
 * built-in commands appear in the popup UI.
 */

import { expect, test } from '../fixtures';
import type { Page } from '@playwright/test';

const BuiltInStyles = ['singleLink', 'tabLinkList', 'tabTaskList', 'tabTitleList', 'tabUrlList'];

async function setBuiltIns(page: Page, extensionId: string, visible: boolean): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/dist/static/menu-commands.html`);
  await page.waitForLoadState('networkidle');

  for (const style of BuiltInStyles) {
    const checkbox = page.locator(`input[data-built-in-style="${style}"]`);
    await (visible ? checkbox.check() : checkbox.uncheck());
  }
  await page.waitForTimeout(200);
}

async function disableBuiltIns(page: Page, extensionId: string): Promise<void> {
  await setBuiltIns(page, extensionId, false);
}

async function enableBuiltIns(page: Page, extensionId: string): Promise<void> {
  await setBuiltIns(page, extensionId, true);
}

test.describe('Built-in style visibility', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await enableBuiltIns(page, extensionId);
  });

  test('hides built-in popup commands when toggled off', async ({ page, extensionId }) => {
    await disableBuiltIns(page, extensionId);

    const popupUrl = `chrome-extension://${extensionId}/dist/static/popup.html`;
    await page.goto(popupUrl);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#current-tab-link')).toBeHidden();
    await expect(page.locator('#all-tabs-link-as-list')).toBeHidden();
    await expect(page.locator('#all-tabs-link-as-task-list')).toBeHidden();
    await expect(page.locator('#all-tabs-title-as-list')).toBeHidden();
    await expect(page.locator('#all-tabs-url-as-list')).toBeHidden();
    await expect(page.locator('#highlighted-tabs-link-as-list')).toBeHidden();
    await expect(page.locator('#highlighted-tabs-link-as-task-list')).toBeHidden();
    await expect(page.locator('#highlighted-tabs-title-as-list')).toBeHidden();
    await expect(page.locator('#highlighted-tabs-url-as-list')).toBeHidden();
  });

  test('shows built-in popup commands when re-enabled', async ({ page, extensionId }) => {
    const popupUrl = `chrome-extension://${extensionId}/dist/static/popup.html`;
    await page.goto(popupUrl);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#current-tab-link')).toBeVisible();
    await expect(page.locator('#all-tabs-link-as-list')).toBeVisible();
    await expect(page.locator('#all-tabs-link-as-task-list')).toBeVisible();
    await expect(page.locator('#all-tabs-title-as-list')).toBeVisible();
    await expect(page.locator('#all-tabs-url-as-list')).toBeVisible();
    await expect(page.locator('#highlighted-tabs-link-as-list')).toBeVisible();
    await expect(page.locator('#highlighted-tabs-link-as-task-list')).toBeVisible();
    await expect(page.locator('#highlighted-tabs-title-as-list')).toBeVisible();
    await expect(page.locator('#highlighted-tabs-url-as-list')).toBeVisible();
  });
});
