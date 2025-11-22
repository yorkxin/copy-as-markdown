import { html, render } from '../vendor/uhtml.js';
import CustomFormatsStorage from '../storage/custom-formats-storage.js';
import CustomFormat from '../lib/custom-format.js';
import type { Context, RenderInput, RenderInputLink } from '../lib/custom-format.js';
import { menuView } from './menu.js';

interface CustomFormatState {
  ready: boolean;
  flashMessage: string;
  context: Context;
  slot: string;
  name: string;
  template: string;
  showInMenus: boolean;
  preview: string;
  templateError: boolean;
}

const root = document.getElementById('options-permissions-root') ?? document.getElementById('custom-format-root') ?? document.body;

let state: CustomFormatState = {
  ready: false,
  flashMessage: '',
  context: 'multiple-links',
  slot: '1',
  name: '',
  template: '',
  showInMenus: false,
  preview: '',
  templateError: false,
};

function setState(next: Partial<CustomFormatState>): void {
  state = { ...state, ...next };
  render(root, view(state));
}

function view(s: CustomFormatState) {
  const disableAll = !s.ready;
  const defaultName = `Custom Format ${s.slot}`;
  const displayName = s.name || defaultName;
  return html`
  <div class="container section is-max-desktop">
    <h1 class="title">Copy as Markdown</h1>
    ${s.flashMessage
      ? html`<div class="notification is-danger">
          <button class="delete" aria-label="Close notification" onclick=${() => setState({ flashMessage: '' })}></button>
          ${s.flashMessage}
        </div>`
      : null}
    <div class="columns">
      <div class="column is-narrow" id="menu">
        ${menuView(window.location)}
      </div>
      <div class="column">
        <div class="box">
          <h2 class="title is-3">${displayName} (<span class="is-small">${s.context === 'multiple-links' ? 'Multiple Links' : 'Single Link'}</span>)</h2>
          <div class="field">
            <label class="label">Display</label>
            <div class="control">
              <input
                id="input-show-in-menus"
                class="checkbox"
                type="checkbox"
                checked=${s.showInMenus}
                disabled=${disableAll}
                onchange=${(e: Event) => onChangeShowInMenus((e.target as HTMLInputElement).checked)}
              >
              <label for="input-show-in-menus">Show in Popup Menu</label>
            </div>
          </div>
          <div class="field">
            <label class="label" for="input-name">Display Name on Menu</label>
            <div class="control">
              <input
                id="input-name"
                class="input"
                type="text"
                placeholder=${defaultName}
                value=${displayName}
                disabled=${disableAll}
                oninput=${(e: Event) => setState({ name: (e.target as HTMLInputElement).value })}
              >
            </div>
          </div>
          <div class="field">
            <label class="label" for="input-template">Template</label>
            <div class="control">
              <textarea
                id="input-template"
                class=${`textarea is-family-code is-size-7 ${s.templateError ? 'is-danger' : ''}`}
                rows="7"
                value=${s.template}
                disabled=${disableAll}
                oninput=${(e: Event) => onChangeTemplate((e.target as HTMLTextAreaElement).value)}
              ></textarea>
            </div>
            <p id="error-template" class=${`help is-danger ${s.templateError ? '' : 'is-hidden'}`}>Invalid template</p>
            <details>
              <summary>Input</summary>
              <pre class="is-size-7"><code id="sample-input">${JSON.stringify(sampleInputForContext(s.context), null, 2)}</code></pre>
            </details>

          </div>
          <div class="field">
            <label class="label">Preview</label>
            <div class="control">
              <textarea id="preview" class="textarea is-family-code is-size-7" rows="7" disabled>${s.preview}</textarea>
            </div>
          </div>

        </div>

        <div class="field is-grouped">
          <div class="control">
            <button
              id="save"
              class="button is-primary"
              disabled=${disableAll || s.templateError}
              onclick=${onSave}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
}

function sampleInputForContext(context: Context): RenderInput | RenderInputLink {
  if (context === 'single-link') return UI.sampleInputForOneLink;
  return UI.sampleInputForTabs;
}

async function onChangeShowInMenus(checked: boolean): Promise<void> {
  setState({ showInMenus: checked });
}

async function onChangeTemplate(value: string): Promise<void> {
  setState({ template: value });
  await renderPreview();
}

async function renderPreview(): Promise<void> {
  try {
    const customFormat = new CustomFormat({
      slot: state.slot,
      context: state.context,
      name: state.name,
      template: state.template,
      showInMenus: state.showInMenus,
    });
    const preview = customFormat.render(sampleInputForContext(state.context));
    setState({ preview, templateError: false, flashMessage: '' });
  } catch (err) {
    console.error(err);
    setState({ preview: '', templateError: true });
  }
}

async function onSave(): Promise<void> {
  if (!state.ready || state.templateError) return;
  try {
    const customFormat = new CustomFormat({
      slot: state.slot,
      context: state.context,
      name: state.name,
      template: state.template,
      showInMenus: state.showInMenus,
    });
    await CustomFormatsStorage.save(state.context, state.slot, customFormat);
    setState({ flashMessage: '' });
  } catch (error) {
    console.error('failed to save custom format', error);
    setState({ flashMessage: 'Failed to save custom format. Please try again.' });
  }
}

async function loadCustomFormat(context: Context, slot: string): Promise<void> {
  const customFormat = await CustomFormatsStorage.get(context, slot);
  setState({
    context,
    slot,
    name: customFormat.name,
    template: customFormat.template,
    showInMenus: customFormat.showInMenus,
    ready: true,
  });
  await renderPreview();
}

function parseParams(): { context: Context; slot: string } {
  const params = new URLSearchParams(window.location.search);
  const slot = params.get('slot');
  const context = params.get('context') as Context | null;
  if (!slot || !context) {
    throw new TypeError('Missing required URL parameters: slot and context');
  }
  return { slot, context };
}

document.addEventListener('DOMContentLoaded', async () => {
  render(root, view(state));
  try {
    const { slot, context } = parseParams();
    await loadCustomFormat(context, slot);
  } catch (error) {
    console.error('failed to load custom format', error);
    setState({ flashMessage: 'Failed to load custom format. Please reopen the page.' });
  }
});

// Sample inputs reused from old UI
class UI {
  static get sampleInputForOneLink(): RenderInputLink {
    return { title: 'Example 1', url: 'https://example.com/1', number: 1 };
  }

  static get sampleInputForTabs(): RenderInput {
    return {
      links: [
        { title: 'Example 1', url: 'https://example.com/1', number: 1 },
        { title: 'Example 2', url: 'https://example.com/2', number: 2 },
        { title: 'Example 3', url: 'https://example.com/3', number: 3 },
        { title: 'Example 4', url: 'https://example.com/4', number: 4 },
        { title: 'Example 5', url: 'https://example.com/5', number: 5 },
        { title: 'Example 6', url: 'https://example.com/6', number: 6 },
        { title: 'Example 7', url: 'https://example.com/7', number: 7 },
      ],
      grouped: [
        {
          title: 'Example 1',
          url: 'https://example.com/1',
          isGroup: false,
          number: 1,
          links: [],
        },
        {
          title: 'Example 2',
          url: 'https://example.com/2',
          isGroup: false,
          number: 2,
          links: [],
        },
        {
          title: 'Group 1',
          url: null,
          isGroup: true,
          number: 3,
          links: [
            {
              title: 'Example 3',
              url: 'https://example.com/3',
              isGroup: false,
              number: 1,
              links: [],
            },
            {
              title: 'Example 4',
              url: 'https://example.com/4',
              isGroup: false,
              number: 2,
              links: [],
            },
            {
              title: 'Example 5',
              url: 'https://example.com/5',
              isGroup: false,
              number: 3,
              links: [],
            },
          ],
        },
        {
          title: 'Example 6',
          url: 'https://example.com/6',
          isGroup: false,
          number: 4,
          links: [],
        },
        {
          title: 'Example 7',
          url: 'https://example.com/7',
          isGroup: false,
          number: 5,
          links: [],
        },
      ],
    };
  }
}
