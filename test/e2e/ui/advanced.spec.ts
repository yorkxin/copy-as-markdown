/**
 * E2E tests for the Advanced options page.
 *
 * This page owns link-text escaping, the one Markdown preference that still
 * spans output contexts. Its reset must restore only that preference, and the
 * resets owned by other pages must leave it alone.
 */

import { expect, test } from '../fixtures';
import type { Page } from '@playwright/test';

function url(extensionId: string, page: string): string {
  return `chrome-extension://${extensionId}/dist/static/${page}`;
}

function readSync(page: Page, keys: string[]) {
  return page.evaluate((keys: string[]) => chrome.storage.sync.get(keys), keys);
}

test.describe('Advanced page', () => {
  test('is reachable under Others from other options pages', async ({ page, extensionId }) => {
    await page.goto(url(extensionId, 'options.html'));
    await page.waitForLoadState('networkidle');

    const others = page.locator('#menu .menu-label', { hasText: 'Others' }).locator('+ .menu-list');
    await expect(others.locator('a[href="advanced.html"]')).toHaveText('Advanced');
    await expect(others.locator('a[href="options-permissions.html"]')).toHaveText('Permissions');

    await page.locator('#menu a[href="advanced.html"]').click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h2')).toContainText('Advanced');
  });

  test('keeps Advanced and Permissions under Others on the Advanced page itself', async ({ page, extensionId }) => {
    await page.goto(url(extensionId, 'advanced.html'));
    await page.waitForLoadState('networkidle');

    const others = page.locator('#menu .menu-label', { hasText: 'Others' }).locator('+ .menu-list');
    await expect(others.locator('a[href="advanced.html"]')).toHaveClass(/is-active/);
    await expect(others.locator('a[href="options-permissions.html"]')).toBeVisible();
  });

  // Every page carries its own copy of the sidebar, so placement is asserted on
  // all of them — a page missed during the move is invisible from any one page.
  const pagesWithNav = [
    'options.html',
    'advanced.html',
    'options-permissions.html',
    'menu-commands.html',
    'multiple-links.html',
    'single-link.html',
    'custom-format.html',
    'custom-format-help.html',
    'about.html',
  ];

  for (const name of pagesWithNav) {
    test(`lists Advanced and Permissions under Others on ${name}`, async ({ page, extensionId }) => {
      await page.goto(url(extensionId, name));
      await page.waitForLoadState('networkidle');

      const general = page.locator('#menu .menu-label', { hasText: 'General' }).locator('+ .menu-list');
      const others = page.locator('#menu .menu-label', { hasText: 'Others' }).locator('+ .menu-list');

      await expect(others.locator('a[href="advanced.html"]')).toHaveCount(1);
      await expect(others.locator('a[href="options-permissions.html"]')).toHaveCount(1);
      await expect(general.locator('a[href="options-permissions.html"]')).toHaveCount(0);
    });
  }

  test('says the preference does not affect Copy Selection', async ({ page, extensionId }) => {
    await page.goto(url(extensionId, 'advanced.html'));
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#form-link-text-always-escape-brackets'))
      .toContainText('does not affect Copy Selection');
  });

  test('persists the preference across reloads', async ({ page, extensionId }) => {
    await page.goto(url(extensionId, 'advanced.html'));
    await page.waitForLoadState('networkidle');

    const checkbox = page.locator('input[name="enabled"]');
    await expect(checkbox).not.toBeChecked();

    await checkbox.check();
    await page.waitForTimeout(500);

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('input[name="enabled"]')).toBeChecked();
    expect(await readSync(page, ['linkTextAlwaysEscapeBrackets']))
      .toEqual({ linkTextAlwaysEscapeBrackets: true });
  });

  test('reset restores only link-text escaping', async ({ page, extensionId }) => {
    await page.goto(url(extensionId, 'options.html'));
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="character"][value="asterisk"]').check();
    await page.waitForTimeout(200);
    await page.locator('input[name="indentation"][value="tab"]').check();
    await page.waitForTimeout(200);

    await page.goto(url(extensionId, 'advanced.html'));
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="enabled"]').check();
    await page.waitForTimeout(500);

    await page.getByTestId('reset-advanced').click();
    await page.waitForTimeout(500);

    await expect(page.locator('input[name="enabled"]')).not.toBeChecked();

    // The Markdown Style page's own settings survive untouched.
    expect(await readSync(page, [
      'selection.markdown.bulletListMarker',
      'multipleLinks.markdown.bulletListMarker',
      'multipleLinks.markdown.tabGroupIndentation',
    ])).toEqual({
      'selection.markdown.bulletListMarker': '*',
      'multipleLinks.markdown.bulletListMarker': '*',
      'multipleLinks.markdown.tabGroupIndentation': 'tab',
    });
  });

  test('survives the Markdown Style page reset', async ({ page, extensionId }) => {
    await page.goto(url(extensionId, 'advanced.html'));
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="enabled"]').check();
    await page.waitForTimeout(500);

    await page.goto(url(extensionId, 'options.html'));
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="character"][value="asterisk"]').check();
    await page.waitForTimeout(200);
    await page.locator('#reset').click();
    await page.waitForTimeout(500);

    await expect(page.locator('input[name="character"][value="dash"]')).toBeChecked();

    await page.goto(url(extensionId, 'advanced.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[name="enabled"]')).toBeChecked();
  });

  test('survives revoking every permission', async ({ page, extensionId }) => {
    await page.goto(url(extensionId, 'advanced.html'));
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="enabled"]').check();
    await page.waitForTimeout(500);

    await page.goto(url(extensionId, 'options.html'));
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="character"][value="asterisk"]').check();
    await page.waitForTimeout(200);

    await page.goto(url(extensionId, 'menu-commands.html'));
    await page.waitForLoadState('networkidle');
    await page.getByTestId('builtin-tabTitleList').uncheck();
    await page.waitForTimeout(500);

    await page.goto(url(extensionId, 'options-permissions.html'));
    await page.waitForLoadState('networkidle');
    await page.locator('#revoke-all').click();
    await page.waitForTimeout(500);

    expect(await readSync(page, [
      'linkTextAlwaysEscapeBrackets',
      'selection.markdown.bulletListMarker',
      'builtin.style.tabTitleList',
    ])).toEqual({
      'linkTextAlwaysEscapeBrackets': true,
      'selection.markdown.bulletListMarker': '*',
      'builtin.style.tabTitleList': false,
    });
  });
});
