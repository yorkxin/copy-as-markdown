import type { BuiltInStyleKey } from '../lib/built-in-style-settings.js';
import BuiltInStyleSettings from '../lib/built-in-style-settings.js';

function showFlash(message: string): void {
  const flash = document.getElementById('flash-error');
  if (!flash) return;
  flash.classList.remove('is-hidden');
  const p = flash.querySelector('p');
  if (p) p.textContent = message;
}

function hideFlash(): void {
  const flash = document.getElementById('flash-error');
  if (!flash) return;
  flash.classList.add('is-hidden');
  const p = flash.querySelector('p');
  if (p) p.textContent = '';
}

function checkboxKey(target: EventTarget | null): BuiltInStyleKey | null {
  if (!(target instanceof HTMLInputElement)) return null;
  const key = target.dataset.builtInStyle as BuiltInStyleKey | undefined;
  return key ?? null;
}

async function loadBuiltInCheckboxes(): Promise<void> {
  const form = document.forms.namedItem('form-display-items');
  if (!form) return;

  const settings = await BuiltInStyleSettings.getAll();
  form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-built-in-style]').forEach((checkbox) => {
    const key = checkbox.dataset.builtInStyle as BuiltInStyleKey | undefined;
    if (!key) return;
    checkbox.checked = settings[key];
  });
}

function wireBuiltInCheckboxes(): void {
  const form = document.forms.namedItem('form-display-items');
  if (!form) return;

  form.addEventListener('change', async (event) => {
    const key = checkboxKey(event.target);
    if (!key) return;

    const checkbox = event.target as HTMLInputElement;
    try {
      await BuiltInStyleSettings.set(key, checkbox.checked);
      hideFlash();
    } catch (error) {
      console.error('failed to save built-in menu visibility', error);
      checkbox.checked = !checkbox.checked;
      showFlash('Failed to save setting. Please try again.');
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadBuiltInCheckboxes();
    wireBuiltInCheckboxes();
    hideFlash();
  } catch (error) {
    console.error('failed to initialize built-in menu visibility', error);
    showFlash('Failed to load settings. Please refresh.');
  }
});

