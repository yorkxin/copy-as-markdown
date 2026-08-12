/**
 * E2E tests for migrating legacy Markdown preferences into context-owned
 * storage, asserted through real `chrome.storage.sync` and the settings page.
 *
 * The clipboard-facing half of this coverage lives in
 * `test/e2e/formatting/settings-migration.spec.ts`.
 */

import type { BrowserContext, Worker } from '@playwright/test';
import { expect, test } from '../fixtures';
import { getServiceWorker, wait } from '../helpers';

const LegacyUnorderedListKey = 'styleOfUnorderedList ';
const LegacyCodeBlockKey = 'styleOfCodeBlock';
const LegacyTabGroupIndentationKey = 'style.tabgroup.indentation ';

const SelectionBulletKey = 'selection.markdown.bulletListMarker';
const SelectionCodeBlockKey = 'selection.markdown.codeBlockStyle';
const MultipleLinksBulletKey = 'multipleLinks.markdown.bulletListMarker';
const MultipleLinksIndentationKey = 'multipleLinks.markdown.tabGroupIndentation';

async function seedStorage(serviceWorker: Worker, items: Record<string, unknown>): Promise<void> {
  await serviceWorker.evaluate(async (toSet) => {
    await chrome.storage.sync.set(toSet);
  }, items);
}

async function readStorage(serviceWorker: Worker): Promise<Record<string, unknown>> {
  return await serviceWorker.evaluate(async () => {
    return await chrome.storage.sync.get(null);
  });
}

function optionsUrlOf(extensionId: string): string {
  return `chrome-extension://${extensionId}/dist/static/options.html`;
}

async function openOptionsPage(context: BrowserContext, extensionId: string): Promise<void> {
  const optionsPage = await context.newPage();
  await optionsPage.goto(optionsUrlOf(extensionId));
  await optionsPage.waitForLoadState('networkidle');
  await wait(500);
  await optionsPage.close();
}

test.describe('Markdown settings migration', () => {
  let serviceWorker: Worker;

  test.beforeEach(async ({ context }) => {
    serviceWorker = await getServiceWorker(context);
  });

  test('moves a legacy profile into context-owned keys and drops the legacy ones', async ({ context, extensionId }) => {
    await seedStorage(serviceWorker, {
      [LegacyUnorderedListKey]: 'asterisk',
      [LegacyCodeBlockKey]: 'indented',
      [LegacyTabGroupIndentationKey]: 'tab',
    });

    await openOptionsPage(context, extensionId);

    const stored = await readStorage(serviceWorker);
    expect(stored[SelectionBulletKey]).toBe('*');
    expect(stored[SelectionCodeBlockKey]).toBe('indented');
    expect(stored[MultipleLinksBulletKey]).toBe('*');
    expect(stored[MultipleLinksIndentationKey]).toBe('tab');
    expect(stored).not.toHaveProperty(LegacyUnorderedListKey);
    expect(stored).not.toHaveProperty(LegacyCodeBlockKey);
    expect(stored).not.toHaveProperty(LegacyTabGroupIndentationKey);
  });

  test('keeps the migrated preferences visible in the settings page after a reload', async ({ context, extensionId }) => {
    await seedStorage(serviceWorker, {
      [LegacyUnorderedListKey]: 'plus',
      [LegacyCodeBlockKey]: 'indented',
    });

    const optionsPage = await context.newPage();
    await optionsPage.goto(optionsUrlOf(extensionId));
    await optionsPage.waitForLoadState('networkidle');
    await wait(500);
    await optionsPage.reload();
    await optionsPage.waitForLoadState('networkidle');

    await expect(optionsPage.locator('input[name="bullet-list-marker"][value="+"]')).toBeChecked();
    await expect(optionsPage.locator('input[name="code-block-style"][value="indented"]')).toBeChecked();
    await optionsPage.close();
  });

  test('starts both format pages on the migrated marker, then lets them diverge', async ({ context, extensionId }) => {
    await seedStorage(serviceWorker, { [LegacyUnorderedListKey]: 'asterisk' });

    const copySelectionPage = await context.newPage();
    await copySelectionPage.goto(optionsUrlOf(extensionId));
    await copySelectionPage.waitForLoadState('networkidle');
    await wait(500);
    await expect(copySelectionPage.locator('input[name="bullet-list-marker"][value="*"]')).toBeChecked();

    const multipleLinksPage = await context.newPage();
    await multipleLinksPage.goto(`chrome-extension://${extensionId}/dist/static/multiple-links.html`);
    await multipleLinksPage.waitForLoadState('networkidle');
    await wait(500);
    // Both contexts inherited the one legacy choice, so nothing changed on upgrade.
    await expect(multipleLinksPage.locator('input[name="bullet-list-marker"][value="*"]')).toBeChecked();

    // Changing one context leaves the other where the migration put it.
    await copySelectionPage.locator('input[name="bullet-list-marker"][value="+"]').check();
    await wait(500);

    await multipleLinksPage.reload();
    await multipleLinksPage.waitForLoadState('networkidle');
    await expect(multipleLinksPage.locator('input[name="bullet-list-marker"][value="*"]')).toBeChecked();

    const stored = await readStorage(serviceWorker);
    expect(stored[SelectionBulletKey]).toBe('+');
    expect(stored[MultipleLinksBulletKey]).toBe('*');

    await copySelectionPage.close();
    await multipleLinksPage.close();
  });
});
