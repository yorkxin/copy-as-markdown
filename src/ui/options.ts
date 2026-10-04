import '../ensure-browser-global.js'; // Installs `browser` before dependent modules evaluate.
import { isBulletListMarker } from '../lib/markdown.js';
import { ensureMarkdownSettingsMigrated, resetSelectionSettings } from '../lib/markdown-settings.js';
import SelectionSettings, { isCodeBlockStyle, isEmDelimiter, isFence, isHeadingStyle, isLinkReferenceStyle, isStrongDelimiter } from '../lib/selection-settings.js';
import { hideFlash, showFlash } from './flash.js';

// This page owns Copy Selection's Markdown formatting settings.
const BulletListMarkerFormId = 'form-selection-bullet-list-marker';
const CodeBlockStyleFormId = 'form-selection-code-block-style';
const EmDelimiterFormId = 'form-selection-em-delimiter';
const StrongDelimiterFormId = 'form-selection-strong-delimiter';
const HeadingStyleFormId = 'form-selection-heading-style';
const FenceFormId = 'form-selection-fence';
const LinkStyleFormId = 'form-selection-link-style';

// The UI presents four output formats; storage retains Turndown's two independent options.
type LinkFormat = 'inlined' | 'full' | 'collapsed' | 'shortcut';

function isLinkFormat(value: unknown): value is LinkFormat {
  return value === 'inlined' || isLinkReferenceStyle(value);
}

async function saveLinkFormat(value: LinkFormat): Promise<void> {
  if (value === 'inlined') await SelectionSettings.setLinkStyle('inlined');
  else await SelectionSettings.setReferencedLinkStyle(value);
}

function radioGroup(formId: string, name: string): RadioNodeList | null {
  const form = document.forms.namedItem(formId);
  if (!form) return null;
  return form.elements.namedItem(name) as RadioNodeList | null;
}

function updateFenceAvailability(): void {
  const fenceFieldset = document.querySelector<HTMLFieldSetElement>(`#${FenceFormId} fieldset`);
  const codeBlockStyles = radioGroup(CodeBlockStyleFormId, 'code-block-style');
  if (fenceFieldset && codeBlockStyles) {
    fenceFieldset.disabled = codeBlockStyles.value === 'indented';
  }
}

async function loadSettings(): Promise<void> {
  const { bulletListMarker, codeBlockStyle, emDelimiter, strongDelimiter, headingStyle, fence, linkStyle, linkReferenceStyle } = await SelectionSettings.getAll();

  const markers = radioGroup(BulletListMarkerFormId, 'bullet-list-marker');
  if (markers) markers.value = bulletListMarker;

  const codeBlockStyles = radioGroup(CodeBlockStyleFormId, 'code-block-style');
  if (codeBlockStyles) codeBlockStyles.value = codeBlockStyle;

  const emphasis = radioGroup(EmDelimiterFormId, 'em-delimiter');
  if (emphasis) emphasis.value = emDelimiter;

  const strong = radioGroup(StrongDelimiterFormId, 'strong-delimiter');
  if (strong) strong.value = strongDelimiter;

  const headings = radioGroup(HeadingStyleFormId, 'heading-style');
  if (headings) headings.value = headingStyle;

  const fences = radioGroup(FenceFormId, 'fence');
  if (fences) fences.value = fence;

  const links = radioGroup(LinkStyleFormId, 'link-style');
  if (links) links.value = linkStyle === 'inlined' ? 'inlined' : linkReferenceStyle;

  updateFenceAvailability();
}

/** After a failed write, storage is re-read to include concurrent changes from other pages. */
async function refresh(): Promise<void> {
  try {
    await loadSettings();
  } catch (error) {
    console.error('failed to reload Copy Selection settings after a failed write', error);
  }
}

function wireSetting<T extends string>(
  formId: string,
  isValid: (value: unknown) => value is T,
  save: (value: T) => Promise<void>,
  onChange?: () => void,
): void {
  const form = document.forms.namedItem(formId);
  if (!form) return;

  form.addEventListener('change', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !isValid(target.value)) return;

    // XXX: this is ugly but shoganai until we migrate to a mini framework such as Preact.
    onChange?.();

    try {
      await save(target.value);
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
      await resetSelectionSettings();
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
  wireSetting(BulletListMarkerFormId, isBulletListMarker, SelectionSettings.setBulletListMarker);
  wireSetting(CodeBlockStyleFormId, isCodeBlockStyle, SelectionSettings.setCodeBlockStyle, updateFenceAvailability);
  wireSetting(EmDelimiterFormId, isEmDelimiter, SelectionSettings.setEmDelimiter);
  wireSetting(StrongDelimiterFormId, isStrongDelimiter, SelectionSettings.setStrongDelimiter);
  wireSetting(HeadingStyleFormId, isHeadingStyle, SelectionSettings.setHeadingStyle);
  wireSetting(FenceFormId, isFence, SelectionSettings.setFence);
  wireSetting(LinkStyleFormId, isLinkFormat, saveLinkFormat);
  wireReset();

  await ensureMarkdownSettingsMigrated();

  try {
    await loadSettings();
    hideFlash();
  } catch (error) {
    console.error('error getting settings', error);
    showFlash('Failed to load settings. Please try again.');
  }
});

browser.storage.sync.onChanged.addListener(async (changes) => {
  const hasSettingsChanged = Object.keys(changes).some(key => SelectionSettings.keys.includes(key));
  if (hasSettingsChanged) {
    await refresh();
  }
});
