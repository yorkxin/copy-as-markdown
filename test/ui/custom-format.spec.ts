import { page } from '@vitest/browser/context';
import { beforeAll, describe, expect, it } from 'vitest';
import { UI } from '../../src/ui/custom-format.js';
import CustomFormat from '../../src/lib/custom-format.js';

async function loadCustomFormatHtml(): Promise<void> {
  const response = await fetch('/src/static/custom-format.html');
  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
}

describe('custom format UI', () => {
  beforeAll(async () => {
    await loadCustomFormatHtml();

    const ui = new UI(document, '1', 'multiple-links');
    const customFormat = new CustomFormat({
      slot: '1',
      context: 'multiple-links',
      name: 'My Format',
      template: 'tmpl',
      showInMenus: true,
    });
    ui.load(customFormat);
  });

  it('loads and renders custom format', async () => {
    const nameInput = page.getByLabelText('Display Name on Menu');
    const templateInput = page.getByLabelText('Template');
    const showCheckbox = page.getByLabelText('Show in Popup Menu');
    const preview = document.getElementById('preview') as HTMLTextAreaElement;

    await expect.element(nameInput).toHaveValue('My Format');
    await expect.element(templateInput).toHaveValue('tmpl');
    await expect.element(showCheckbox).toBeChecked();
    expect(preview.value).toContain('tmpl');
  });

  it('shows template error and disables save on render failure', async () => {
    const templateInput = page.getByLabelText('Template');
    await templateInput.fill('{{');
    const save = page.getByRole('button', { name: 'Save' });
    await expect.element(save).not.toBeEnabled();

    const errorMessage = page.getByTestId('error-template');
    await expect.element(errorMessage).not.toHaveClass('is-hdden');
  });
});
