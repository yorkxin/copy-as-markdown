/**
 * E2E tests for the Menu Commands options page.
 *
 * This page owns which built-in and custom-format commands appear in menus.
 * The reset restores the default menu composition and must never touch a
 * custom format's name or template.
 */

import { expect, test } from '../fixtures';
import type { Page } from '@playwright/test';

function menuCommandsUrl(extensionId: string): string {
  return `chrome-extension://${extensionId}/dist/static/menu-commands.html`;
}

async function readCustomFormat(page: Page, context: string, slot: string) {
  return page.evaluate(({ context, slot }: { context: string; slot: string }) => {
    const prefix = `custom_formats.${context}.${slot}`;
    return chrome.storage.sync.get([`${prefix}.name`, `${prefix}.template`, `${prefix}.show_in_menus`])
      .then(stored => ({
        name: stored[`${prefix}.name`],
        template: stored[`${prefix}.template`],
        showInMenus: stored[`${prefix}.show_in_menus`],
      }));
  }, { context, slot });
}

async function writeCustomFormat(
  page: Page,
  context: string,
  slot: string,
  values: { name: string; template: string; showInMenus: boolean },
): Promise<void> {
  await page.evaluate(({ context, slot, values }: {
    context: string;
    slot: string;
    values: { name: string; template: string; showInMenus: boolean };
  }) => {
    const prefix = `custom_formats.${context}.${slot}`;
    return chrome.storage.sync.set({
      [`${prefix}.name`]: values.name,
      [`${prefix}.template`]: values.template,
      [`${prefix}.show_in_menus`]: values.showInMenus,
    });
  }, { context, slot, values });
}

test.describe('Menu Commands page', () => {
  test('is reachable from other options pages', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/dist/static/options.html`);
    await page.waitForLoadState('networkidle');

    await page.locator('#menu a[href="menu-commands.html"]').click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h2')).toContainText('Menu Commands');
  });

  test('persists built-in and custom format visibility across reloads', async ({ page, extensionId }) => {
    await page.goto(menuCommandsUrl(extensionId));
    await page.waitForLoadState('networkidle');

    await page.locator('input[data-built-in-style="tabTitleList"]').uncheck();
    await page.getByTestId('custom-format-single-link-1').check();
    await page.getByTestId('custom-format-multiple-links-2').check();
    await page.waitForTimeout(300);

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('input[data-built-in-style="tabTitleList"]')).not.toBeChecked();
    await expect(page.locator('input[data-built-in-style="tabLinkList"]')).toBeChecked();
    await expect(page.getByTestId('custom-format-single-link-1')).toBeChecked();
    await expect(page.getByTestId('custom-format-multiple-links-2')).toBeChecked();
  });

  test('shows user-defined custom format names', async ({ page, extensionId }) => {
    await page.goto(menuCommandsUrl(extensionId));
    await writeCustomFormat(page, 'single-link', '3', {
      name: 'Wiki Link',
      template: '[[{{title}}]]',
      showInMenus: false,
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Copy as Custom Format 3 (Wiki Link)')).toBeVisible();
  });

  test('reset restores the default menu composition without touching format content', async ({ page, extensionId }) => {
    await page.goto(menuCommandsUrl(extensionId));
    await writeCustomFormat(page, 'multiple-links', '4', {
      name: 'Keep My Name',
      template: '{{#links}}{{url}}\n{{/links}}',
      showInMenus: true,
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.locator('input[data-built-in-style="tabUrlList"]').uncheck();
    await page.waitForTimeout(300);
    await expect(page.getByTestId('custom-format-multiple-links-4')).toBeChecked();

    await page.getByTestId('reset-menu-visibility').click();
    await page.waitForTimeout(300);

    await expect(page.locator('input[data-built-in-style="singleLink"]')).toBeChecked();
    await expect(page.locator('input[data-built-in-style="tabLinkList"]')).toBeChecked();
    await expect(page.locator('input[data-built-in-style="tabTaskList"]')).toBeChecked();
    await expect(page.locator('input[data-built-in-style="tabTitleList"]')).toBeChecked();
    await expect(page.locator('input[data-built-in-style="tabUrlList"]')).toBeChecked();
    await expect(page.getByTestId('custom-format-multiple-links-4')).not.toBeChecked();

    expect(await readCustomFormat(page, 'multiple-links', '4')).toMatchObject({
      name: 'Keep My Name',
      template: '{{#links}}{{url}}\n{{/links}}',
    });
  });

  test('custom format visibility set here drives the popup', async ({ page, extensionId }) => {
    await page.goto(menuCommandsUrl(extensionId));
    await writeCustomFormat(page, 'single-link', '2', {
      name: 'Popup Format',
      template: '{{title}}',
      showInMenus: false,
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('custom-format-single-link-2').check();
    await page.waitForTimeout(300);

    const popupUrl = `chrome-extension://${extensionId}/dist/static/popup.html`;
    await page.goto(popupUrl);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#current-tab-custom-format-2')).toBeVisible();

    await page.goto(menuCommandsUrl(extensionId));
    await page.waitForLoadState('networkidle');
    await page.getByTestId('custom-format-single-link-2').uncheck();
    await page.waitForTimeout(300);

    await page.goto(popupUrl);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#current-tab-custom-format-2')).not.toBeVisible();
  });
});

test.describe('Format pages after the move', () => {
  test('Single Link has no visibility controls and no reset', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/dist/static/single-link.html`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
    await expect(page.locator('#reset')).toHaveCount(0);
    await expect(page.locator('#menu ul[data-menu-custom-format-context="single-link"] a')).toHaveCount(5);
  });

  test('Multiple Links has no visibility controls', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/dist/static/multiple-links.html`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
    await expect(page.locator('#menu ul[data-menu-custom-format-context="multiple-links"] a')).toHaveCount(5);
  });

  test('the custom format editor has no reset control', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/dist/static/custom-format.html?context=single-link&slot=1`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#reset')).toHaveCount(0);
  });
});
