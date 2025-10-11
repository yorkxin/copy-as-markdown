import CustomFormatsStorage from '../storage/custom-formats-storage';
import CustomFormat from '../lib/custom-format';
import type { Context, RenderInput, RenderInputLink } from '../lib/custom-format';

class UI {
  slot: string;
  context: Context;
  sampleInput: RenderInput | RenderInputLink;
  elInputName: HTMLInputElement;
  elInputTemplate: HTMLInputElement;
  elShowInMenus: HTMLInputElement;
  elPreview: HTMLTextAreaElement;
  elErrorTemplate: HTMLDivElement;
  elSave: HTMLButtonElement;

  constructor(doc: Document) {
    const params = new URLSearchParams(document.location.search);
    const slot = params.get('slot');
    const context = params.get('context') as Context | null;

    if (!slot || !context) {
      throw new TypeError('Missing required URL parameters: slot and context');
    }

    this.slot = slot;
    this.context = context;
    this.sampleInput = {} as RenderInput | RenderInputLink;

    const placeholder = doc.querySelector<HTMLElement>('[data-placeholder=\'context-in-header\']');
    if (!placeholder) {
      throw new Error('Missing placeholder element');
    }

    switch (this.context) {
      case 'multiple-links':
        this.sampleInput = UI.sampleInputForTabs;
        placeholder.textContent = 'Multiple Links';
        break;
      case 'single-link':
        this.sampleInput = UI.sampleInputForOneLink;
        placeholder.textContent = 'Single Link';
        break;
      default:
        throw new TypeError(`invalid context '${this.context}'`);
    }

    const elInputName = doc.getElementById('input-name') as HTMLInputElement | null;
    const elInputTemplate = doc.getElementById('input-template') as HTMLInputElement | null;
    const elShowInMenus = doc.getElementById('input-show-in-menus') as HTMLInputElement | null;
    const elPreview = doc.getElementById('preview') as HTMLTextAreaElement | null;
    const elErrorTemplate = doc.getElementById('error-template') as HTMLDivElement | null;
    const elSave = doc.getElementById('save') as HTMLButtonElement | null;
    const elSampleInput = doc.getElementById('sample-input');

    if (!elInputName || !elInputTemplate || !elShowInMenus || !elPreview || !elErrorTemplate || !elSave || !elSampleInput) {
      throw new Error('Missing required DOM elements');
    }

    this.elInputName = elInputName;
    this.elInputTemplate = elInputTemplate;
    this.elShowInMenus = elShowInMenus;
    this.elPreview = elPreview;
    this.elErrorTemplate = elErrorTemplate;
    this.elSave = elSave;

    elSampleInput.textContent = JSON.stringify(this.sampleInput, null, 2);

    this.elInputTemplate.addEventListener('input', () => {
      this.renderPreview();
    });

    this.elInputTemplate.addEventListener('change', () => {
      this.renderPreview();
    });

    doc.querySelectorAll<HTMLElement>('[data-placeholder="default-name"]')
      .forEach((el) => {
        el.textContent = this.defaultName();
      });

    this.elInputName.placeholder = this.defaultName();
  }

  load(customFormat: CustomFormat): void {
    this.elInputName.value = customFormat.name === '' ? this.defaultName() : customFormat.name;
    this.elInputTemplate.value = customFormat.template;
    this.elShowInMenus.checked = customFormat.showInMenus;
    this.renderPreview();
  }

  current(): CustomFormat {
    return new CustomFormat({
      slot: this.slot,
      context: this.context,
      name: this.elInputName.value,
      template: this.elInputTemplate.value,
      showInMenus: this.elShowInMenus.checked,
    });
  }

  renderPreview(): void {
    this.elInputTemplate.classList.remove('is-danger');
    this.elErrorTemplate.classList.add('is-hidden');
    this.elSave.disabled = true;

    const customFormat = this.current();

    try {
      this.elPreview.value = customFormat.render(this.sampleInput);
      this.elSave.disabled = false;
    } catch (err) {
      console.error(err);
      this.elInputTemplate.classList.add('is-danger');
      this.elErrorTemplate.classList.remove('is-hidden');
      this.elPreview.value = '';
      this.elSave.disabled = true;
    }
  }

  defaultName(): string {
    return `Custom Format ${this.slot}`;
  }

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
          url: '',
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

document.addEventListener('DOMContentLoaded', async () => {
  const ui = new UI(document);
  const customFormat = await CustomFormatsStorage.get(ui.context, ui.slot);
  ui.load(customFormat);

  ui.elSave.addEventListener('click', async () => {
    await CustomFormatsStorage.save(ui.context, ui.slot, ui.current());
  });
});
