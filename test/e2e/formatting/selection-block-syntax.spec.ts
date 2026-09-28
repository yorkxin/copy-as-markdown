import { expect, test } from '../fixtures';
import { resetMockClipboard, triggerContextMenu, waitForMockClipboard } from '../helpers';

test('applies heading and fence choices to the next Copy Selection without reloading', async ({ page, context, extensionId, serviceWorker }) => {
  await page.goto('http://localhost:5566/selection.html');
  await page.evaluate(() => {
    document.body.innerHTML = '<h1>Heading</h1><pre><code class="language-js">const x = 1;\n</code></pre>';
  });

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/dist/static/options.html`);
  const headings = options.getByRole('group', { name: 'Heading style' });
  const fences = options.getByRole('group', { name: 'Code-fence marker' });
  await expect(headings.getByRole('radio', { name: /ATX/ })).toBeChecked();
  await expect(fences.getByRole('radio', { name: /Backticks/ })).toBeChecked();

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
        // @ts-expect-error - dispatch is available in tests
        return chrome.commands.onCommand.dispatch('selection-as-markdown');
      });
    } else {
      await triggerContextMenu(serviceWorker, 'selection-as-markdown', { frameId: 0 });
    }
    return (await waitForMockClipboard(serviceWorker, 5000)).text;
  }

  expect(await copySelection('command')).toBe('# Heading\n\n```js\nconst x = 1;\n```');

  await options.bringToFront();
  await headings.getByRole('radio', { name: /Setext/ }).check();
  await fences.getByRole('radio', { name: /Tildes/ }).check();
  await expect.poll(() => serviceWorker.evaluate(async () => {
    return await chrome.storage.sync.get([
      'selection.markdown.headingStyle',
      'selection.markdown.fence',
    ]);
  })).toMatchObject({
    'selection.markdown.headingStyle': 'setext',
    'selection.markdown.fence': '~~~',
  });

  const expected = 'Heading\n=======\n\n~~~js\nconst x = 1;\n~~~';
  expect(await copySelection('command')).toBe(expected);
  expect(await copySelection('context-menu')).toBe(expected);

  await options.bringToFront();
  await options.getByTestId('reset-copy-selection').click();
  await expect(headings.getByRole('radio', { name: /ATX/ })).toBeChecked();
  await expect(fences.getByRole('radio', { name: /Backticks/ })).toBeChecked();
  expect(await copySelection('command')).toBe('# Heading\n\n```js\nconst x = 1;\n```');
});
