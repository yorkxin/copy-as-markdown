import { expect, test } from '../fixtures';

/** Requires an open extension page so chrome.storage is available. */
async function clearCustomFormatStorage(page: any, slot: string, context: string) {
  await page.evaluate(({ slot, context }: { slot: string; context: string }) => {
    const keys = [
      `custom_formats.${context}.${slot}.name`,
      `custom_formats.${context}.${slot}.template`,
      `custom_formats.${context}.${slot}.show_in_menus`,
    ];
    return chrome.storage.sync.remove(keys);
  }, { slot, context });
}

test.describe('Custom Format UI', () => {
  test.describe('Single Link Context', () => {
    test('should load, edit, save, and persist custom format', async ({ page, extensionId }) => {
      const customFormatUrl = `chrome-extension://${extensionId}/dist/static/custom-format.html?slot=1&context=single-link`;
      await page.goto(customFormatUrl);

      await clearCustomFormatStorage(page, '1', 'single-link');

      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(page.locator('h1')).toContainText('Copy as Markdown');
      await expect(page.locator('h2')).toContainText('Custom Format 1');
      await expect(page.locator('h2')).toContainText('Single Link');

      const nameInput = page.locator('#input-name');
      const templateInput = page.locator('#input-template');
      const showInMenusCheckbox = page.locator('#input-show-in-menus');
      const previewTextarea = page.locator('#preview');
      const saveButton = page.locator('#save');

      await expect(nameInput).toHaveValue('Custom Format 1');
      await expect(templateInput).toHaveValue('');
      await expect(showInMenusCheckbox).not.toBeChecked();
      await expect(previewTextarea).toHaveValue('');
      // An empty template is valid and renders an empty string.
      await expect(saveButton).toBeEnabled();

      await nameInput.fill('My Custom Link Format');
      await templateInput.fill('{{title}} - {{url}}');
      await showInMenusCheckbox.check();

      await page.waitForTimeout(200);

      await expect(previewTextarea).toHaveValue('Example 1 - https://example.com/1');

      await expect(saveButton).toBeEnabled();

      await saveButton.click();

      await page.waitForTimeout(500);

      await page.reload();
      await page.waitForLoadState('networkidle');

      const nameInputAfterReload = page.locator('#input-name');
      const templateInputAfterReload = page.locator('#input-template');
      const showInMenusCheckboxAfterReload = page.locator('#input-show-in-menus');
      const previewTextareaAfterReload = page.locator('#preview');

      await expect(nameInputAfterReload).toHaveValue('My Custom Link Format');
      await expect(templateInputAfterReload).toHaveValue('{{title}} - {{url}}');
      await expect(showInMenusCheckboxAfterReload).toBeChecked();
      await expect(previewTextareaAfterReload).toHaveValue('Example 1 - https://example.com/1');
    });

    test('should show error for invalid template', async ({ page, extensionId }) => {
      const customFormatUrl = `chrome-extension://${extensionId}/dist/static/custom-format.html?slot=2&context=single-link`;
      await page.goto(customFormatUrl);
      await page.waitForLoadState('networkidle');

      const templateInput = page.locator('#input-template');
      const errorMessage = page.locator('#error-template');
      const saveButton = page.locator('#save');

      await expect(errorMessage).toHaveClass(/is-hidden/);

      await templateInput.fill('{{title');

      await page.waitForTimeout(200);

      await expect(errorMessage).not.toHaveClass(/is-hidden/);
      await expect(errorMessage).toContainText('Invalid template');

      await expect(templateInput).toHaveClass(/is-danger/);

      await expect(saveButton).toBeDisabled();
    });

    test('should use default name when name field is empty', async ({ page, extensionId }) => {
      const customFormatUrl = `chrome-extension://${extensionId}/dist/static/custom-format.html?slot=3&context=single-link`;
      await page.goto(customFormatUrl);

      await clearCustomFormatStorage(page, '3', 'single-link');

      await page.reload();
      await page.waitForLoadState('networkidle');

      const nameInput = page.locator('#input-name');
      const templateInput = page.locator('#input-template');
      const saveButton = page.locator('#save');

      await expect(nameInput).toHaveAttribute('placeholder', 'Custom Format 3');

      await templateInput.fill('[{{title}}]({{url}})');
      await page.waitForTimeout(200);

      await expect(saveButton).toBeEnabled();
      await saveButton.click();
      await page.waitForTimeout(500);

      await page.reload();
      await page.waitForLoadState('networkidle');

      const nameInputAfterReload = page.locator('#input-name');
      // Stored empty names display the slot's default name.
      await expect(nameInputAfterReload).toHaveValue('Custom Format 3');
      await expect(nameInputAfterReload).toHaveAttribute('placeholder', 'Custom Format 3');
    });
  });

  test.describe('Multiple Links Context', () => {
    test('should handle multiple links template', async ({ page, extensionId }) => {
      const customFormatUrl = `chrome-extension://${extensionId}/dist/static/custom-format.html?slot=1&context=multiple-links`;
      await page.goto(customFormatUrl);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('h2')).toContainText('Multiple Links');

      const nameInput = page.locator('#input-name');
      const templateInput = page.locator('#input-template');
      const showInMenusCheckbox = page.locator('#input-show-in-menus');
      const previewTextarea = page.locator('#preview');
      const saveButton = page.locator('#save');

      await nameInput.fill('Numbered List Format');
      await templateInput.fill('{{#links}}{{number}}. [{{title}}]({{url}})\n{{/links}}');
      await showInMenusCheckbox.check();

      await page.waitForTimeout(200);

      const previewValue = await previewTextarea.inputValue();
      expect(previewValue).toContain('1. [Example 1](https://example.com/1)');
      expect(previewValue).toContain('2. [Example 2](https://example.com/2)');
      expect(previewValue).toContain('7. [Example 7](https://example.com/7)');

      await expect(saveButton).toBeEnabled();
      await saveButton.click();
      await page.waitForTimeout(500);

      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(page.locator('#input-name')).toHaveValue('Numbered List Format');
      await expect(page.locator('#input-template')).toHaveValue('{{#links}}{{number}}. [{{title}}]({{url}})\n{{/links}}');
      await expect(page.locator('#input-show-in-menus')).toBeChecked();
    });

    test('should handle grouped links template', async ({ page, extensionId }) => {
      const customFormatUrl = `chrome-extension://${extensionId}/dist/static/custom-format.html?slot=2&context=multiple-links`;
      await page.goto(customFormatUrl);
      await page.waitForLoadState('networkidle');

      const templateInput = page.locator('#input-template');
      const previewTextarea = page.locator('#preview');

      const groupedTemplate = `{{#grouped}}{{#isGroup}}## {{title}}
{{#links}}- [{{title}}]({{url}})
{{/links}}{{/isGroup}}{{^isGroup}}- [{{title}}]({{url}})
{{/isGroup}}{{/grouped}}`;

      await templateInput.fill(groupedTemplate);
      await page.waitForTimeout(200);

      const previewValue = await previewTextarea.inputValue();
      expect(previewValue).toContain('## Group 1');
      expect(previewValue).toContain('[Example 1](https://example.com/1)');
      expect(previewValue).toContain('[Example 3](https://example.com/3)');
    });
  });

  test.describe('Preview Functionality', () => {
    test('should update preview on input event', async ({ page, extensionId }) => {
      const customFormatUrl = `chrome-extension://${extensionId}/dist/static/custom-format.html?slot=1&context=single-link`;
      await page.goto(customFormatUrl);
      await page.waitForLoadState('networkidle');

      const templateInput = page.locator('#input-template');
      const previewTextarea = page.locator('#preview');

      await templateInput.fill('{{title}}');
      await page.waitForTimeout(200);
      await expect(previewTextarea).toHaveValue('Example 1');

      await templateInput.fill('{{title}} - {{url}}');
      await page.waitForTimeout(200);
      await expect(previewTextarea).toHaveValue('Example 1 - https://example.com/1');

      await templateInput.fill('[{{title}}]({{url}})');
      await page.waitForTimeout(200);
      await expect(previewTextarea).toHaveValue('[Example 1](https://example.com/1)');
    });
  });

  test.describe('Sample Input Display', () => {
    test('should show sample input for single-link context', async ({ page, extensionId }) => {
      const customFormatUrl = `chrome-extension://${extensionId}/dist/static/custom-format.html?slot=1&context=single-link`;
      await page.goto(customFormatUrl);
      await page.waitForLoadState('networkidle');

      const sampleInput = page.locator('#sample-input');
      const sampleText = await sampleInput.textContent();

      expect(sampleText).toContain('"title": "Example 1"');
      expect(sampleText).toContain('"url": "https://example.com/1"');
      expect(sampleText).toContain('"number": 1');
    });

    test('should show sample input for multiple-links context', async ({ page, extensionId }) => {
      const customFormatUrl = `chrome-extension://${extensionId}/dist/static/custom-format.html?slot=1&context=multiple-links`;
      await page.goto(customFormatUrl);
      await page.waitForLoadState('networkidle');

      const sampleInput = page.locator('#sample-input');
      const sampleText = await sampleInput.textContent();

      expect(sampleText).toContain('"links"');
      expect(sampleText).toContain('"grouped"');
      expect(sampleText).toContain('"isGroup"');
    });
  });

  test.describe('Show in Menus', () => {
    test('should appear in popup when "show in menus" is enabled (single-link)', async ({ page, extensionId }) => {
      const customFormatUrl = `chrome-extension://${extensionId}/dist/static/custom-format.html?slot=4&context=single-link`;
      await page.goto(customFormatUrl);
      await page.waitForLoadState('networkidle');

      const nameInput = page.locator('#input-name');
      const templateInput = page.locator('#input-template');
      const showInMenusCheckbox = page.locator('#input-show-in-menus');
      const saveButton = page.locator('#save');

      await nameInput.fill('Test Menu Format');
      await templateInput.fill('{{title}} - {{url}}');
      await showInMenusCheckbox.check();
      await page.waitForTimeout(200);

      await expect(saveButton).toBeEnabled();
      await saveButton.click();
      await page.waitForTimeout(500);

      const popupUrl = `chrome-extension://${extensionId}/dist/static/popup.html`;
      await page.goto(popupUrl);
      await page.waitForLoadState('networkidle');

      const customFormatButton = page.locator('#current-tab-custom-format-4');
      await expect(customFormatButton).toBeVisible();
      await expect(customFormatButton).toContainText('Current tab');
      await expect(customFormatButton).toContainText('Test Menu Format');

      await page.goto(customFormatUrl);
      await page.waitForLoadState('networkidle');

      await page.locator('#input-show-in-menus').uncheck();
      await page.waitForTimeout(200);
      await page.locator('#save').click();
      await page.waitForTimeout(500);

      await page.goto(popupUrl);
      await page.waitForLoadState('networkidle');

      const customFormatButtonAfter = page.locator('#current-tab-custom-format-4');
      await expect(customFormatButtonAfter).not.toBeVisible();
    });

    test('should appear in popup when "show in menus" is enabled (multiple-links)', async ({ page, extensionId }) => {
      const customFormatUrl = `chrome-extension://${extensionId}/dist/static/custom-format.html?slot=5&context=multiple-links`;
      await page.goto(customFormatUrl);
      await page.waitForLoadState('networkidle');

      const nameInput = page.locator('#input-name');
      const templateInput = page.locator('#input-template');
      const showInMenusCheckbox = page.locator('#input-show-in-menus');
      const saveButton = page.locator('#save');

      await nameInput.fill('Batch Export Format');
      await templateInput.fill('{{#links}}- [{{title}}]({{url}})\n{{/links}}');
      await showInMenusCheckbox.check();
      await page.waitForTimeout(200);

      await expect(saveButton).toBeEnabled();
      await saveButton.click();
      await page.waitForTimeout(500);

      const popupUrl = `chrome-extension://${extensionId}/dist/static/popup.html`;
      await page.goto(popupUrl);
      await page.waitForLoadState('networkidle');

      // Multiple-link formats appear for both all-tabs and highlighted-tabs exports.
      const allTabsButton = page.locator('#all-tabs-custom-format-5');
      await expect(allTabsButton).toBeVisible();
      await expect(allTabsButton).toContainText('All tabs');
      await expect(allTabsButton).toContainText('Batch Export Format');

      const highlightedTabsButton = page.locator('#highlighted-tabs-custom-format-5');
      await expect(highlightedTabsButton).toBeVisible();
      await expect(highlightedTabsButton).toContainText('Selected tabs');
      await expect(highlightedTabsButton).toContainText('Batch Export Format');

      await page.goto(customFormatUrl);
      await page.waitForLoadState('networkidle');

      await page.locator('#input-show-in-menus').uncheck();
      await page.waitForTimeout(200);
      await page.locator('#save').click();
      await page.waitForTimeout(500);

      await page.goto(popupUrl);
      await page.waitForLoadState('networkidle');

      const allTabsButtonAfter = page.locator('#all-tabs-custom-format-5');
      await expect(allTabsButtonAfter).not.toBeVisible();

      const highlightedTabsButtonAfter = page.locator('#highlighted-tabs-custom-format-5');
      await expect(highlightedTabsButtonAfter).not.toBeVisible();
    });
  });
});
