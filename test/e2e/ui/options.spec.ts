/**
 * E2E tests for the format options pages - UI Tests
 *
 * Copy Selection and Multiple Links each own their formatting settings, so this
 * covers persistence across reloads and that one page's reset never reaches into
 * the other's settings.
 */

import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

function copySelectionUrl(extensionId: string): string {
  return `chrome-extension://${extensionId}/dist/static/options.html`;
}

function multipleLinksUrl(extensionId: string): string {
  return `chrome-extension://${extensionId}/dist/static/multiple-links.html`;
}

function marker(page: Page, value: string) {
  return page.locator(`input[name="bullet-list-marker"][value="${value}"]`);
}

async function open(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
}

test.describe('Format options pages - UI Tests', () => {
  test('lands on Copy Selection when the options page is opened', async ({ page, extensionId }) => {
    await open(page, copySelectionUrl(extensionId));

    await expect(page.getByRole('heading', { name: /Copy Selection/ })).toBeVisible();
    await expect(page.locator('#menu a.is-active')).toHaveText('Copy Selection');
  });

  test('keeps Single Link blank with its custom formats and no reset', async ({ page, extensionId }) => {
    await open(page, `chrome-extension://${extensionId}/dist/static/single-link.html`);

    await expect(page.locator('#reset')).toHaveCount(0);
    await expect(page.locator('input[name="bullet-list-marker"]')).toHaveCount(0);
    await expect(
      page.locator('[data-menu-custom-format-context="single-link"] [data-menu-custom-format-slot]'),
    ).toHaveCount(5);
  });

  test('persists each page\'s settings across reloads', async ({ page, extensionId }) => {
    await open(page, copySelectionUrl(extensionId));
    await marker(page, '*').check();
    await page.locator('input[name="code-block-style"][value="indented"]').check();
    await page.waitForTimeout(200);

    await open(page, multipleLinksUrl(extensionId));
    await marker(page, '+').check();
    await page.locator('input[name="indentation"][value="tab"]').check();
    await page.waitForTimeout(200);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(marker(page, '+')).toBeChecked();
    await expect(page.locator('input[name="indentation"][value="tab"]')).toBeChecked();

    await open(page, copySelectionUrl(extensionId));
    await expect(marker(page, '*')).toBeChecked();
    await expect(page.locator('input[name="code-block-style"][value="indented"]')).toBeChecked();
  });

  test('resets Copy Selection without touching Multiple Links', async ({ page, extensionId }) => {
    await open(page, multipleLinksUrl(extensionId));
    await marker(page, '+').check();
    await page.waitForTimeout(200);

    await open(page, copySelectionUrl(extensionId));
    await marker(page, '*').check();
    await page.locator('input[name="code-block-style"][value="indented"]').check();
    await page.waitForTimeout(200);

    await page.getByTestId('reset-copy-selection').click();
    await page.waitForTimeout(500);

    await expect(marker(page, '-')).toBeChecked();
    await expect(page.locator('input[name="code-block-style"][value="fenced"]')).toBeChecked();

    await open(page, multipleLinksUrl(extensionId));
    await expect(marker(page, '+')).toBeChecked();
  });

  test('resets Multiple Links without touching Copy Selection', async ({ page, extensionId }) => {
    await open(page, copySelectionUrl(extensionId));
    await marker(page, '*').check();
    await page.waitForTimeout(200);

    await open(page, multipleLinksUrl(extensionId));
    await marker(page, '+').check();
    await page.locator('input[name="indentation"][value="tab"]').check();
    await page.waitForTimeout(200);

    await page.getByTestId('reset-multiple-links').click();
    await page.waitForTimeout(500);

    await expect(marker(page, '-')).toBeChecked();
    await expect(page.locator('input[name="indentation"][value="spaces"]')).toBeChecked();

    await open(page, copySelectionUrl(extensionId));
    await expect(marker(page, '*')).toBeChecked();
  });

  test('leaves menu visibility and custom formats alone when a format page resets', async ({ page, extensionId }) => {
    await open(page, `chrome-extension://${extensionId}/dist/static/menu-commands.html`);
    await page.getByTestId('builtin-tabTitleList').uncheck();
    await page.waitForTimeout(200);

    await open(page, `chrome-extension://${extensionId}/dist/static/custom-format.html?context=multiple-links&slot=1`);
    await page.locator('#input-name').fill('My Format');
    await page.locator('#input-template').fill('{{title}}');
    await page.locator('#save').click();
    await page.waitForTimeout(500);

    await open(page, copySelectionUrl(extensionId));
    await page.getByTestId('reset-copy-selection').click();
    await page.waitForTimeout(200);

    await open(page, multipleLinksUrl(extensionId));
    await page.getByTestId('reset-multiple-links').click();
    await page.waitForTimeout(500);

    expect(await page.evaluate(() => chrome.storage.sync.get([
      'builtin.style.tabTitleList',
      'custom_formats.multiple-links.1.name',
      'custom_formats.multiple-links.1.template',
    ]))).toEqual({
      'builtin.style.tabTitleList': false,
      'custom_formats.multiple-links.1.name': 'My Format',
      'custom_formats.multiple-links.1.template': '{{title}}',
    });
  });
});
