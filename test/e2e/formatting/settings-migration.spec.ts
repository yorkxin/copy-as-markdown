/**
 * E2E coverage for the output side of the Markdown settings migration: once a
 * legacy profile has been migrated, Copy Selection and Multiple Links read
 * independent bullet markers.
 *
 * The storage-and-settings-page half lives in
 * `test/e2e/ui/settings-migration.spec.ts`.
 */

import type { BrowserContext, Page, Worker } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '../fixtures';
import { getServiceWorker, resetMockClipboard, wait, waitForMockClipboard } from '../helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LegacyUnorderedListKey = 'styleOfUnorderedList ';
const LegacyCodeBlockKey = 'styleOfCodeBlock';
const SelectionBulletKey = 'selection.markdown.bulletListMarker';

const selectionCodeBlockLines = [
  'const greet = (name) => {',
  `  console.log(\`hello, \${name}\`);`,
  '};',
  'greet(\'world\');',
];

async function seedStorage(serviceWorker: Worker, items: Record<string, unknown>): Promise<void> {
  await serviceWorker.evaluate(async (toSet) => {
    await chrome.storage.sync.set(toSet);
  }, items);
}

async function selectPreByCodeLanguage(page: Page, language: string): Promise<void> {
  await page.evaluate((lang) => {
    const range = document.createRange();
    const codeNode = document.querySelector(`pre > code.language-${lang}`);
    const pre = codeNode?.closest('pre');
    if (pre) {
      range.selectNode(pre);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, language);
}

/** Opening the settings page migrates whatever legacy profile is in storage. */
async function migrateViaOptionsPage(context: BrowserContext, extensionId: string): Promise<void> {
  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/dist/static/options.html`);
  await optionsPage.waitForLoadState('networkidle');
  await wait(500);
  await optionsPage.close();
}

test.describe('Markdown settings migration - output', () => {
  let serviceWorker: Worker;

  test.beforeEach(async ({ context }) => {
    serviceWorker = await getServiceWorker(context);
    await resetMockClipboard(serviceWorker);
  });

  test.describe('Code Block Style', () => {
    test('keeps rendering indented code blocks after migrating the legacy choice', async ({ page, context, extensionId }) => {
      await seedStorage(serviceWorker, { [LegacyCodeBlockKey]: 'indented' });
      await migrateViaOptionsPage(context, extensionId);

      await page.goto('http://localhost:5566/selection.html');
      await page.waitForLoadState('networkidle');
      await selectPreByCodeLanguage(page, 'js');

      await serviceWorker.evaluate(() => {
        // @ts-expect-error - dispatch is available in tests
        chrome.commands.onCommand.dispatch('selection-as-markdown');
      });

      const clipboardText = (await waitForMockClipboard(serviceWorker, 5000)).text;
      expect(clipboardText).toBe(`    ${selectionCodeBlockLines.join('\n    ')}`);
    });

    test('keeps rendering fenced code blocks when that was the legacy choice', async ({ page, context, extensionId }) => {
      await seedStorage(serviceWorker, { [LegacyCodeBlockKey]: 'fenced' });
      await migrateViaOptionsPage(context, extensionId);

      await page.goto('http://localhost:5566/selection.html');
      await page.waitForLoadState('networkidle');
      await selectPreByCodeLanguage(page, 'js');

      await serviceWorker.evaluate(() => {
        // @ts-expect-error - dispatch is available in tests
        chrome.commands.onCommand.dispatch('selection-as-markdown');
      });

      const clipboardText = (await waitForMockClipboard(serviceWorker, 5000)).text;
      expect(clipboardText).toBe(`\`\`\`js\n${selectionCodeBlockLines.join('\n')}\n\`\`\``);
    });
  });

  test('lets Copy Selection and Multiple Links use different bullet markers after migration', async ({ page, context, extensionId }) => {
    await seedStorage(serviceWorker, { [LegacyUnorderedListKey]: 'asterisk' });
    await migrateViaOptionsPage(context, extensionId);

    // Diverge the two contexts the way the dedicated pages eventually will.
    await seedStorage(serviceWorker, { [SelectionBulletKey]: '+' });
    await wait(500);

    // Multiple Links keeps the migrated asterisk...
    await page.goto('http://localhost:5566/0.html');
    await page.waitForLoadState('networkidle');
    await serviceWorker.evaluate(() => {
      // @ts-expect-error - dispatch is available in tests
      chrome.commands.onCommand.dispatch('all-tabs-link-as-list');
    });
    const tabListText = (await waitForMockClipboard(serviceWorker, 5000)).text;
    expect(tabListText).toContain('* [');
    expect(tabListText).not.toContain('+ [');

    // ...while Copy Selection uses its own marker.
    await resetMockClipboard(serviceWorker);
    await page.goto('http://localhost:5566/selection.html');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      const range = document.createRange();
      const testUl = document.querySelector('#test-ul');
      if (testUl) {
        range.selectNodeContents(testUl);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    });
    await serviceWorker.evaluate(() => {
      // @ts-expect-error - dispatch is available in tests
      chrome.commands.onCommand.dispatch('selection-as-markdown');
    });
    const selectionText = (await waitForMockClipboard(serviceWorker, 5000)).text;
    const expectedSelection = await readFile(join(__dirname, '../../../fixtures/selection-ul-plus.md'), 'utf-8');
    expect(selectionText).toBe(expectedSelection);
  });
});
