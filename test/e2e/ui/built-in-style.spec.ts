/**
 * E2E tests for built-in style visibility toggles.
 *
 * These checkboxes live on the single-link and multiple-links option pages
 * and control which built-in commands appear in the popup UI.
 */

import { expect, test } from '../fixtures';
import type { Page } from '@playwright/test';

async function disableBuiltIns(page: Page, extensionId: string): Promise<void> {
  const singleLinkUrl = `chrome-extension://${extensionId}/dist/static/single-link.html`;
  await page.goto(singleLinkUrl);
  await page.waitForLoadState('networkidle');
  await page.locator('input[data-built-in-style="singleLink"]').uncheck();
  await page.waitForTimeout(100);

  const multiLinkUrl = `chrome-extension://${extensionId}/dist/static/multiple-links.html`;
  await page.goto(multiLinkUrl);
  await page.waitForLoadState('networkidle');
  await page.locator('input[data-built-in-style="tabLinkList"]').uncheck();
  await page.locator('input[data-built-in-style="tabTaskList"]').uncheck();
  await page.locator('input[data-built-in-style="tabTitleList"]').uncheck();
  await page.locator('input[data-built-in-style="tabUrlList"]').uncheck();
  await page.waitForTimeout(200);
}

async function enableBuiltIns(page: Page, extensionId: string): Promise<void> {
  const singleLinkUrl = `chrome-extension://${extensionId}/dist/static/single-link.html`;
  await page.goto(singleLinkUrl);
  await page.waitForLoadState('networkidle');
  await page.locator('input[data-built-in-style="singleLink"]').check();
  await page.waitForTimeout(100);

  const multiLinkUrl = `chrome-extension://${extensionId}/dist/static/multiple-links.html`;
  await page.goto(multiLinkUrl);
  await page.waitForLoadState('networkidle');
  await page.locator('input[data-built-in-style="tabLinkList"]').check();
  await page.locator('input[data-built-in-style="tabTaskList"]').check();
  await page.locator('input[data-built-in-style="tabTitleList"]').check();
  await page.locator('input[data-built-in-style="tabUrlList"]').check();
  await page.waitForTimeout(200);
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
