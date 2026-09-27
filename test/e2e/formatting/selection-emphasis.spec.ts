import { expect, test } from '../fixtures';
import { resetMockClipboard, waitForMockClipboard } from '../helpers';

test('applies emphasis choices to the next Copy Selection and resets them without reloading', async ({ page, context, extensionId, serviceWorker }) => {
  await page.goto('http://localhost:5566/selection.html');
  await page.evaluate(() => {
    document.body.innerHTML = '<p><em>text</em> and <strong>bold</strong></p>';
    const range = document.createRange();
    range.selectNodeContents(document.body);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  });
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/dist/static/options.html`);
  const emphasis = options.getByRole('group', { name: 'Emphasis (italics)', exact: true });
  const strong = options.getByRole('group', { name: 'Strong emphasis (bold)', exact: true });
  await expect(emphasis.getByRole('radio', { name: 'Underscore (_text_)', exact: true })).toBeChecked();
  await expect(strong.getByRole('radio', { name: 'Double asterisks (**text**)', exact: true })).toBeChecked();

  async function copySelection(): Promise<string | null> {
    await page.bringToFront();
    await resetMockClipboard(serviceWorker);
    await serviceWorker.evaluate(() => {
      // @ts-expect-error - dispatch is available in tests
      return chrome.commands.onCommand.dispatch('selection-as-markdown');
    });
    return (await waitForMockClipboard(serviceWorker, 5000)).text;
  }

  expect(await copySelection()).toBe('_text_ and **bold**');
  await options.bringToFront();
  await emphasis.getByRole('radio', { name: 'Asterisk (*text*)', exact: true }).check();
  await expect.poll(() => serviceWorker.evaluate(async () => {
    return (await chrome.storage.sync.get('selection.markdown.emDelimiter'))['selection.markdown.emDelimiter'];
  })).toBe('*');
  expect(await copySelection()).toBe('*text* and **bold**');

  await options.bringToFront();
  await strong.getByRole('radio', { name: 'Double underscores (__text__)', exact: true }).check();
  await expect.poll(() => serviceWorker.evaluate(async () => {
    return (await chrome.storage.sync.get('selection.markdown.strongDelimiter'))['selection.markdown.strongDelimiter'];
  })).toBe('__');
  expect(await copySelection()).toBe('*text* and __bold__');

  await options.bringToFront();
  await options.getByTestId('reset-copy-selection').click();
  await expect(emphasis.getByRole('radio', { name: 'Underscore (_text_)', exact: true })).toBeChecked();
  await expect(strong.getByRole('radio', { name: 'Double asterisks (**text**)', exact: true })).toBeChecked();
  expect(await copySelection()).toBe('_text_ and **bold**');
});
