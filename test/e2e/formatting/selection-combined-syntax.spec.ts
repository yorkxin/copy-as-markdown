import { expect, test } from '../fixtures';
import { resetMockClipboard, triggerContextMenu, waitForMockClipboard } from '../helpers';

test('applies combined syntax through both selection handlers without reloading and keeps other contexts isolated', async ({ page, context, extensionId, serviceWorker }) => {
  test.setTimeout(30000);
  await page.goto('http://localhost:5566/selection.html');
  await page.evaluate(() => {
    document.title = 'Selection [formatting]';
    document.body.innerHTML = '<h1>Heading</h1><p><em>italic</em> and <strong>bold</strong> with '
      + '<a href="https://example.com/">Example</a></p><ul><li>item</li></ul>'
      + '<pre><code class="language-js">const x = 1;\n</code></pre>';
  });

  const unrelated = {
    'multipleLinks.markdown.bulletListMarker': '*',
    'multipleLinks.markdown.tabGroupIndentation': 'tab',
    'linkTextAlwaysEscapeBrackets': true,
    'builtin.style.tabTitleList': false,
    'custom_formats.single-link.1.name': 'Single',
    'custom_formats.single-link.1.template': '{{title}}: {{url}}',
    'custom_formats.multiple-links.1.name': 'Multiple',
    'custom_formats.multiple-links.1.template': '{{#links}}{{title}}: {{url}}{{/links}}',
  };
  await serviceWorker.evaluate(items => chrome.storage.sync.set(items), unrelated);

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/dist/static/options.html`);
  const links = options.getByRole('group', { name: 'Link style', exact: true });
  await expect(links.getByRole('radio', { name: /^Inline\b/ })).toBeChecked();

  async function copySelection(method: 'command' | 'context-menu'): Promise<string | null> {
    await page.bringToFront();
    await page.evaluate(() => {
      const range = document.createRange();
      range.selectNodeContents(document.body);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    });
    await resetMockClipboard(serviceWorker);
    if (method === 'command') {
      await serviceWorker.evaluate(() => {
        // Synthetic command event exercises the registered extension handler.
        // @ts-expect-error - dispatch is available in tests
        return chrome.commands.onCommand.dispatch('selection-as-markdown');
      });
    } else {
      await triggerContextMenu(serviceWorker, 'selection-as-markdown', { frameId: 0 });
    }
    return (await waitForMockClipboard(serviceWorker, 5000)).text;
  }

  const ticks = String.fromCharCode(96).repeat(3);
  const defaults = '# Heading\n\n_italic_ and **bold** with [Example](https://example.com/)\n\n'
    + `-   item\n\n${ticks}js\nconst x = 1;\n${ticks}`;
  expect(await copySelection('command')).toBe(defaults);

  await options.bringToFront();
  await options.getByRole('group', { name: 'Heading style' }).getByRole('radio', { name: /Setext/ }).check();
  await options.getByRole('group', { name: 'Emphasis (italics)', exact: true }).getByRole('radio', { name: 'Asterisk (*text*)', exact: true }).check();
  await options.getByRole('group', { name: 'Strong emphasis (bold)', exact: true }).getByRole('radio', { name: 'Double underscores (__text__)', exact: true }).check();
  await options.getByRole('radio', { name: /Plus Signs/ }).check();
  await options.getByRole('group', { name: 'Code-fence marker' }).getByRole('radio', { name: /Tildes/ }).check();
  // Click the example itself, proving the whole label selects its output format.
  await options.locator('label:has(input[value="shortcut"]) samp').click();
  const configured = {
    'selection.markdown.headingStyle': 'setext',
    'selection.markdown.emDelimiter': '*',
    'selection.markdown.strongDelimiter': '__',
    'selection.markdown.bulletListMarker': '+',
    'selection.markdown.fence': '~~~',
    'selection.markdown.linkStyle': 'referenced',
    'selection.markdown.linkReferenceStyle': 'shortcut',
  };
  await expect.poll(() => serviceWorker.evaluate(keys => chrome.storage.sync.get(keys), Object.keys(configured))).toEqual(configured);

  const prefix = 'Heading\n=======\n\n*italic* and __bold__ with ';
  const suffix = '\n\n+   item\n\n~~~js\nconst x = 1;\n~~~';
  const referenced = `${prefix}[Example]${suffix}\n\n[Example]: https://example.com/`;
  expect(await copySelection('command')).toBe(referenced);
  expect(await copySelection('context-menu')).toBe(referenced);

  await options.bringToFront();
  await links.getByRole('radio', { name: /^Inline\b/ }).check();
  await expect.poll(() => serviceWorker.evaluate(() => chrome.storage.sync.get([
    'selection.markdown.linkStyle',
    'selection.markdown.linkReferenceStyle',
  ]))).toEqual({
    'selection.markdown.linkStyle': 'inlined',
    'selection.markdown.linkReferenceStyle': 'shortcut',
  });
  expect(await copySelection('command')).toBe(`${prefix}[Example](https://example.com/)${suffix}`);

  await options.bringToFront();
  await links.getByRole('radio', { name: /^Referenced \(full\)/ }).check();
  await expect.poll(() => serviceWorker.evaluate(() => chrome.storage.sync.get([
    'selection.markdown.linkStyle',
    'selection.markdown.linkReferenceStyle',
  ]))).toEqual({
    'selection.markdown.linkStyle': 'referenced',
    'selection.markdown.linkReferenceStyle': 'full',
  });
  expect(await copySelection('context-menu')).toBe(`${prefix}[Example][1]${suffix}\n\n[1]: https://example.com/`);

  // Multiple Links and Single Link must keep their own output while Selection is configured.
  await resetMockClipboard(serviceWorker);
  await serviceWorker.evaluate(() => {
    // @ts-expect-error - dispatch is available in tests
    return chrome.commands.onCommand.dispatch('all-tabs-link-as-list');
  });
  const list = (await waitForMockClipboard(serviceWorker, 5000)).text;
  expect(list).toContain('* [');
  expect(list).not.toContain('+ [');
  expect(list).not.toMatch(/\n\[[^\]]+\]: /);

  await resetMockClipboard(serviceWorker);
  await serviceWorker.evaluate(() => {
    // @ts-expect-error - dispatch is available in tests
    return chrome.commands.onCommand.dispatch('current-tab-link');
  });
  const title = 'Selection \\[formatting\\]';
  expect((await waitForMockClipboard(serviceWorker, 5000)).text).toBe(`[${title}](${page.url()})`);

  await resetMockClipboard(serviceWorker);
  await serviceWorker.evaluate(() => {
    // @ts-expect-error - dispatch is available in tests
    return chrome.commands.onCommand.dispatch('current-tab-custom-format-1');
  });
  expect((await waitForMockClipboard(serviceWorker, 5000)).text).toBe(`${title}: ${page.url()}`);

  await resetMockClipboard(serviceWorker);
  await serviceWorker.evaluate(() => {
    // @ts-expect-error - dispatch is available in tests
    return chrome.commands.onCommand.dispatch('all-tabs-custom-format-1');
  });
  expect((await waitForMockClipboard(serviceWorker, 5000)).text).toContain(`${title}: ${page.url()}`);

  const bookmarkId = await serviceWorker.evaluate(async () => {
    return (await chrome.bookmarks.create({ title: 'Saved', url: 'https://example.com/bookmark' })).id;
  });
  await resetMockClipboard(serviceWorker);
  await triggerContextMenu(serviceWorker, 'bookmark-link', { bookmarkId });
  expect((await waitForMockClipboard(serviceWorker, 5000)).text).toBe('[Saved](https://example.com/bookmark)');

  await options.bringToFront();
  await options.getByTestId('reset-copy-selection').click();
  await expect(links.getByRole('radio', { name: /^Inline\b/ })).toBeChecked();
  await expect(options.getByRole('group', { name: 'Heading style' }).getByRole('radio', { name: /ATX/ })).toBeChecked();
  expect(await copySelection('command')).toBe(defaults);
  expect(await copySelection('context-menu')).toBe(defaults);
  expect(await serviceWorker.evaluate(keys => chrome.storage.sync.get(keys), Object.keys(unrelated))).toEqual(unrelated);
});
