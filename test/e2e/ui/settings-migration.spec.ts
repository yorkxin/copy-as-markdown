import { chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '../fixtures';
import { getServiceWorker } from '../helpers';

const legacy = {
  'styleOfUnorderedList ': 'asterisk',
  'styleOfCodeBlock': 'indented',
  'style.tabgroup.indentation ': 'tab',
};
const migrated = {
  'selection.markdown.bulletListMarker': '*',
  'selection.markdown.codeBlockStyle': 'indented',
  'multipleLinks.markdown.bulletListMarker': '*',
  'multipleLinks.markdown.tabGroupIndentation': 'tab',
};

test('migrates legacy settings on browser restart before any options page opens', async ({ extensionPath }) => {
  const profile = await mkdtemp(join(tmpdir(), 'selection-migration-'));
  const launch = () => chromium.launchPersistentContext(profile, {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  let context = await launch();
  try {
    const original = await getServiceWorker(context);
    await original.evaluate(items => chrome.storage.sync.set(items), legacy);
    // Seeding an already running worker must not itself run the startup migration.
    expect(await original.evaluate(keys => chrome.storage.sync.get(keys), Object.keys(migrated))).toEqual({});
    await context.close();

    // A fresh browser runs background.ts against the same persisted legacy profile.
    context = await launch();
    const worker = await getServiceWorker(context);
    expect(worker).not.toBe(original);
    await expect.poll(() => worker.evaluate(keys => chrome.storage.sync.get(keys), [
      ...Object.keys(legacy),
      ...Object.keys(migrated),
    ])).toEqual(migrated);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('options fallback migrates a running legacy profile and displays the saved preferences after reload', async ({ context, extensionId, serviceWorker }) => {
  await serviceWorker.evaluate(items => chrome.storage.sync.set(items), legacy);
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/dist/static/options.html`);
  await expect(options.locator('input[name="bullet-list-marker"][value="*"]')).toBeChecked();
  await expect.poll(() => serviceWorker.evaluate(keys => chrome.storage.sync.get(keys), [
    ...Object.keys(legacy),
    ...Object.keys(migrated),
  ])).toEqual(migrated);
  await options.reload();
  await expect(options.locator('input[name="bullet-list-marker"][value="*"]')).toBeChecked();
  await expect(options.locator('input[name="code-block-style"][value="indented"]')).toBeChecked();
});
