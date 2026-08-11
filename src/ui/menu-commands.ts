import '../ensure-browser-global.js'; // MUST be first — installs `browser` for old Chrome.
import type { BuiltInStyleKey } from '../lib/built-in-style-settings.js';
import type CustomFormat from '../lib/custom-format.js';
import type { Context } from '../lib/custom-format.js';
import type { MenuVisibility } from '../lib/menu-visibility-settings.js';
import MenuVisibilitySettings from '../lib/menu-visibility-settings.js';
import { hideFlash, showFlash } from './flash.js';

function builtInCheckboxes(): NodeListOf<HTMLInputElement> {
  return document.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-built-in-style]');
}

function customFormatCheckboxes(): NodeListOf<HTMLInputElement> {
  return document.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-custom-format-slot]');
}

function labelFor(format: CustomFormat): string {
  const baseLabel = `Copy as Custom Format ${format.slot}`;
  const suffix = format.displayName !== format.defaultName ? ` (${format.displayName})` : '';
  return `${baseLabel}${suffix}`;
}

function apply({ builtIn, customFormats }: MenuVisibility): void {
  builtInCheckboxes().forEach((checkbox) => {
    const key = checkbox.dataset.builtInStyle as BuiltInStyleKey | undefined;
    if (!key) return;
    checkbox.checked = builtIn[key];
  });

  customFormatCheckboxes().forEach((checkbox) => {
    const { customFormatSlot: slot, customFormatContext: context } = checkbox.dataset;
    const format = customFormats.find(
      entry => entry.context === context && entry.slot === slot,
    );
    if (!format) return;

    checkbox.checked = format.showInMenus;
    const labelSpan = checkbox.closest('label')?.querySelector<HTMLElement>('[data-custom-format-label]');
    if (labelSpan) labelSpan.textContent = labelFor(format);
  });
}

async function loadVisibility(): Promise<void> {
  apply(await MenuVisibilitySettings.getAll());
}

/**
 * Put the page back in sync with what is actually persisted after a write
 * fails. Re-reading rather than flipping the checkbox back keeps the UI honest
 * even when the failed write raced another change or applied only in part.
 */
async function rollback(): Promise<void> {
  try {
    await loadVisibility();
  } catch (error) {
    console.error('failed to reload menu visibility after a failed write', error);
  }
}

async function saveCheckbox(checkbox: HTMLInputElement): Promise<void> {
  const builtInKey = checkbox.dataset.builtInStyle as BuiltInStyleKey | undefined;
  if (builtInKey) {
    await MenuVisibilitySettings.setBuiltIn(builtInKey, checkbox.checked);
    return;
  }

  const { customFormatSlot: slot, customFormatContext: context } = checkbox.dataset;
  if (!slot || !context) return;

  await MenuVisibilitySettings.setCustomFormat(context as Context, slot, checkbox.checked);
}

function wireCheckboxes(): void {
  const form = document.getElementById('form-menu-commands');
  if (!form) return;

  form.addEventListener('change', async (event) => {
    const checkbox = event.target;
    if (!(checkbox instanceof HTMLInputElement)) return;

    try {
      await saveCheckbox(checkbox);
      hideFlash();
    } catch (error) {
      console.error('failed to save menu visibility', error);
      await rollback();
      showFlash('Failed to save setting. Please try again.');
    }
  });
}

function wireReset(): void {
  const resetButton = document.querySelector('#reset');
  if (!resetButton) return;

  resetButton.addEventListener('click', async () => {
    try {
      await MenuVisibilitySettings.reset();
      await loadVisibility();
      hideFlash();
    } catch (error) {
      console.error('failed to restore default menu visibility', error);
      // A reset is two writes, so a failure can leave one of them applied.
      // Re-read so the page shows the composition that actually persisted.
      await rollback();
      showFlash('Failed to reset settings. Please try again.');
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  wireCheckboxes();
  wireReset();

  try {
    await loadVisibility();
    hideFlash();
  } catch (error) {
    console.error('failed to load menu visibility', error);
    showFlash('Failed to load settings. Please refresh.');
  }
});
