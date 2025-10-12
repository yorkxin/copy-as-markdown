import CustomFormatsStorage from '../storage/custom-formats-storage.js';
import type { Context } from '../lib/custom-format.js';

async function setVisibility(slot: string, context: Context, visible: boolean): Promise<void> {
  const format = await CustomFormatsStorage.get(context, slot);
  format.showInMenus = visible;
  await CustomFormatsStorage.save(context, format.slot, format);
}

async function initCheckbox(checkbox: HTMLInputElement): Promise<void> {
  const slot = checkbox.dataset.customFormatSlot;
  const context = checkbox.dataset.customFormatContext as Context;

  if (!slot || !context) {
    throw new Error('Missing slot or context data attribute');
  }

  const format = await CustomFormatsStorage.get(context, slot);
  if (format.showInMenus) {
    checkbox.setAttribute('checked', 'true');
  }
  checkbox.addEventListener('change', async (e) => {
    await setVisibility(
      format.slot,
      format.context,
      (e.target as HTMLInputElement).checked,
    );
  });
}

async function checkCustomFormats(context: Context): Promise<void> {
  const checkboxes = document.querySelectorAll<HTMLInputElement>(`input[type='checkbox'][data-custom-format-context='${context}']`);
  const promises: Promise<void>[] = [];
  for (let i = 0; i < checkboxes.length; i += 1) {
    promises.push(initCheckbox(checkboxes[i]!));
  }

  await Promise.all(promises);
}

document.addEventListener('DOMContentLoaded', async () => {
  await checkCustomFormats('single-link');
  await checkCustomFormats('multiple-links');
});
