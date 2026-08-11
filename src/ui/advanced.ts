import '../ensure-browser-global.js'; // MUST be first — installs `browser` for old Chrome.
import Settings from '../lib/settings.js';
import { hideFlash, showFlash } from './flash.js';

const EscapeBracketsFormId = 'form-link-text-always-escape-brackets';

function escapeBracketsForm(): HTMLFormElement | null {
  return document.forms.namedItem(EscapeBracketsFormId);
}

function escapeBracketsCheckbox(): HTMLInputElement | null {
  const form = escapeBracketsForm();
  if (!form) return null;
  return form.elements.namedItem('enabled') as HTMLInputElement | null;
}

async function loadSettings(): Promise<void> {
  const { alwaysEscapeLinkBrackets } = await Settings.getAll();
  const checkbox = escapeBracketsCheckbox();
  if (checkbox) checkbox.checked = alwaysEscapeLinkBrackets;
}

/**
 * Put the checkbox back in sync with what is actually persisted after a write
 * fails. Re-reading rather than flipping the checkbox back keeps the UI honest
 * even when the failed write raced a change made on another page.
 */
async function refresh(): Promise<void> {
  try {
    await loadSettings();
  } catch (error) {
    console.error('failed to reload advanced settings after a failed write', error);
  }
}

function wireCheckbox(): void {
  const form = escapeBracketsForm();
  if (!form) return;

  form.addEventListener('change', async (event) => {
    const checkbox = event.target;
    if (!(checkbox instanceof HTMLInputElement)) return;

    try {
      await Settings.setLinkTextAlwaysEscapeBrackets(checkbox.checked);
      hideFlash();
    } catch (error) {
      console.error('failed to save settings:', error);
      await refresh();
      showFlash('Failed to save setting. Please try again.');
    }
  });
}

function wireReset(): void {
  const resetButton = document.querySelector('#reset');
  if (!resetButton) return;

  resetButton.addEventListener('click', async () => {
    try {
      // Only this page's setting: formatting, menu visibility, and permissions
      // are owned by their own pages and must survive an Advanced reset.
      await Settings.reset();
      await loadSettings();
      hideFlash();
    } catch (error) {
      console.error('failed to reset settings:', error);
      await refresh();
      showFlash('Failed to reset settings. Please try again.');
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  wireCheckbox();
  wireReset();

  try {
    await loadSettings();
    hideFlash();
  } catch (error) {
    console.error('error getting settings', error);
    showFlash('Failed to load settings. Please try again.');
  }
});
