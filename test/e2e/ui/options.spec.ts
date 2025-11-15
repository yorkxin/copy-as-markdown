/**
 * E2E tests for Options Page - UI Tests
 *
 * Tests the settings UI persistence and reset functionality.
 */

import { expect, test } from '../fixtures';

test.describe('Options Page - UI Tests', () => {
  test.describe('Settings Persistence', () => {
    test('should persist settings across page reloads', async ({ page, extensionBaseUrl }) => {
      const optionsUrl = `${extensionBaseUrl}/dist/static/options.html`;

      // Set all settings to non-default values
      await page.goto(optionsUrl);
      await page.waitForLoadState('networkidle');

      const asteriskRadio = page.locator('input[name="character"][value="asterisk"]');
      await asteriskRadio.check();
      await page.waitForTimeout(200);

      const tabIndentationRadio = page.locator('input[name="indentation"][value="tab"]');
      await tabIndentationRadio.check();
      await page.waitForTimeout(200);

      const escapeBracketsCheckbox = page.locator('input[name="enabled"]');
      await escapeBracketsCheckbox.check();
      await page.waitForTimeout(500);

      // Reload the page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify all settings persisted
      const asteriskRadioAfter = page.locator('input[name="character"][value="asterisk"]');
      await expect(asteriskRadioAfter).toBeChecked();

      const tabIndentationRadioAfter = page.locator('input[name="indentation"][value="tab"]');
      await expect(tabIndentationRadioAfter).toBeChecked();

      const escapeBracketsCheckboxAfter = page.locator('input[name="enabled"]');
      await expect(escapeBracketsCheckboxAfter).toBeChecked();
    });

    test('should reset all settings to default when reset button is clicked', async ({ page, extensionBaseUrl }) => {
      const optionsUrl = `${extensionBaseUrl}/dist/static/options.html`;

      // Set all settings to non-default values
      await page.goto(optionsUrl);
      await page.waitForLoadState('networkidle');

      const asteriskRadio = page.locator('input[name="character"][value="asterisk"]');
      await asteriskRadio.check();
      await page.waitForTimeout(200);

      const tabIndentationRadio = page.locator('input[name="indentation"][value="tab"]');
      await tabIndentationRadio.check();
      await page.waitForTimeout(200);

      const escapeBracketsCheckbox = page.locator('input[name="enabled"]');
      await escapeBracketsCheckbox.check();
      await page.waitForTimeout(500);

      // Click reset button
      const resetButton = page.locator('#reset');
      await resetButton.click();
      await page.waitForTimeout(500);

      // Verify all settings reset to defaults
      const dashRadio = page.locator('input[name="character"][value="dash"]');
      await expect(dashRadio).toBeChecked();

      const spacesIndentationRadio = page.locator('input[name="indentation"][value="spaces"]');
      await expect(spacesIndentationRadio).toBeChecked();

      const escapeBracketsCheckboxAfter = page.locator('input[name="enabled"]');
      await expect(escapeBracketsCheckboxAfter).not.toBeChecked();
    });
  });
});
