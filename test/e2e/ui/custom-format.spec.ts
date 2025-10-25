/**
 * E2E tests for Custom Format UI
 *
 * Tests the custom format editor accessible from the extension's options page.
 * The UI allows users to create custom templates using Mustache syntax.
 */

import { expect, test } from '../fixtures';

/**
 * Clear custom format storage for a specific slot and context
 * Must be called AFTER navigating to an extension page
 */
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
      // Navigate to custom format page with slot 1 and single-link context
      const customFormatUrl = `chrome-extension://${extensionId}/dist/static/custom-format.html?slot=1&context=single-link`;
      await page.goto(customFormatUrl);

      // Clear storage after navigating to extension page
      await clearCustomFormatStorage(page, '1', 'single-link');

      // Reload to load cleared data
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify page loaded correctly
      await expect(page.locator('h1')).toContainText('Copy as Markdown');
      await expect(page.locator('h2')).toContainText('Custom Format 1');
      await expect(page.locator('h2')).toContainText('Single Link');

      // Get form elements
      const nameInput = page.locator('#input-name');
      const templateInput = page.locator('#input-template');
      const showInMenusCheckbox = page.locator('#input-show-in-menus');
      const previewTextarea = page.locator('#preview');
      const saveButton = page.locator('#save');

      // Verify initial state - name is pre-filled with default name when empty in storage
      await expect(nameInput).toHaveValue('Custom Format 1');
      await expect(templateInput).toHaveValue('');
      await expect(showInMenusCheckbox).not.toBeChecked();
      await expect(previewTextarea).toHaveValue('');
      // Save button is enabled even with empty template (empty template is valid and renders to empty string)
      await expect(saveButton).toBeEnabled();

      // Fill in the form
      await nameInput.fill('My Custom Link Format');
      await templateInput.fill('{{title}} - {{url}}');
      await showInMenusCheckbox.check();

      // Wait for preview to update
      await page.waitForTimeout(200);

      // Verify preview updates correctly
      await expect(previewTextarea).toHaveValue('Example 1 - https://example.com/1');

      // Save button should be enabled now
      await expect(saveButton).toBeEnabled();

      // Save the format
      await saveButton.click();

      // Wait for save to complete
      await page.waitForTimeout(500);

      // Refresh the page to verify persistence
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify data persisted
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

      // Initially no error
      await expect(errorMessage).toHaveClass(/is-hidden/);

      // Enter invalid Mustache template (unclosed tag)
      await templateInput.fill('{{title');

      // Wait for validation
      await page.waitForTimeout(200);

      // Error should be visible
      await expect(errorMessage).not.toHaveClass(/is-hidden/);
      await expect(errorMessage).toContainText('Invalid template');

      // Template input should have error styling
      await expect(templateInput).toHaveClass(/is-danger/);

      // Save button should be disabled
      await expect(saveButton).toBeDisabled();
    });

    test('should use default name when name field is empty', async ({ page, extensionId }) => {
      const customFormatUrl = `chrome-extension://${extensionId}/dist/static/custom-format.html?slot=3&context=single-link`;
      await page.goto(customFormatUrl);

      // Clear storage after navigating to extension page
      await clearCustomFormatStorage(page, '3', 'single-link');

      // Reload to load cleared data
      await page.reload();
      await page.waitForLoadState('networkidle');

      const nameInput = page.locator('#input-name');
      const templateInput = page.locator('#input-template');
      const saveButton = page.locator('#save');

      // Verify placeholder shows default name
      await expect(nameInput).toHaveAttribute('placeholder', 'Custom Format 3');

      // Leave name empty, just set template
      await templateInput.fill('[{{title}}]({{url}})');
      await page.waitForTimeout(200);

      await expect(saveButton).toBeEnabled();
      await saveButton.click();
      await page.waitForTimeout(500);

      // Reload and verify name shows default (because storage has empty string)
      await page.reload();
      await page.waitForLoadState('networkidle');

      const nameInputAfterReload = page.locator('#input-name');
      // When storage has empty string, the UI loads it with default name
      await expect(nameInputAfterReload).toHaveValue('Custom Format 3');
      await expect(nameInputAfterReload).toHaveAttribute('placeholder', 'Custom Format 3');
    });
  });

  test.describe('Multiple Links Context', () => {
    test('should handle multiple links template', async ({ page, extensionId }) => {
      const customFormatUrl = `chrome-extension://${extensionId}/dist/static/custom-format.html?slot=1&context=multiple-links`;
      await page.goto(customFormatUrl);
      await page.waitForLoadState('networkidle');

      // Verify context in header
      await expect(page.locator('h2')).toContainText('Multiple Links');

      const nameInput = page.locator('#input-name');
      const templateInput = page.locator('#input-template');
      const showInMenusCheckbox = page.locator('#input-show-in-menus');
      const previewTextarea = page.locator('#preview');
      const saveButton = page.locator('#save');

      // Fill in a template that uses the links array
      await nameInput.fill('Numbered List Format');
      await templateInput.fill('{{#links}}{{number}}. [{{title}}]({{url}})\n{{/links}}');
      await showInMenusCheckbox.check();

      await page.waitForTimeout(200);

      // Preview should show the rendered output with all sample links
      const previewValue = await previewTextarea.inputValue();
      expect(previewValue).toContain('1. [Example 1](https://example.com/1)');
      expect(previewValue).toContain('2. [Example 2](https://example.com/2)');
      expect(previewValue).toContain('7. [Example 7](https://example.com/7)');

      await expect(saveButton).toBeEnabled();
      await saveButton.click();
      await page.waitForTimeout(500);

      // Verify persistence
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

      // Template using grouped structure
      const groupedTemplate = `{{#grouped}}{{#isGroup}}## {{title}}
{{#links}}- [{{title}}]({{url}})
{{/links}}{{/isGroup}}{{^isGroup}}- [{{title}}]({{url}})
{{/isGroup}}{{/grouped}}`;

      await templateInput.fill(groupedTemplate);
      await page.waitForTimeout(200);

      // Preview should show grouped output
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

      // Type progressively and verify preview updates
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

      // Should contain single link sample data
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

      // Should contain links array and grouped structure
      expect(sampleText).toContain('"links"');
      expect(sampleText).toContain('"grouped"');
      expect(sampleText).toContain('"isGroup"');
    });
  });
});
