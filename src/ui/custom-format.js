// eslint-disable-next-line max-classes-per-file
import CustomFormatsStorage from '../storage/custom-formats-storage.js';
import CustomFormat from '../lib/custom-format.js';

class UI {
  /**
   *
   * @param doc {Document}
   */
  constructor(doc) {
    const params = new URLSearchParams(document.location.search);
    this.slot = params.get('slot');

    this.elInputName = doc.getElementById('input-name');
    this.elInputTemplate = doc.getElementById('input-template');
    /** @type {HTMLInputElement} */
    this.elShowInPopupMenu = doc.getElementById('input-show-in-popup-menu');
    this.elPreview = doc.getElementById('preview');
    this.elErrorTemplate = doc.getElementById('error-template');
    this.elSave = doc.getElementById('save');

    this.elInputTemplate.addEventListener('input', () => {
      this.renderPreview();
    });

    this.elInputTemplate.addEventListener('change', () => {
      this.renderPreview();
    });

    doc.querySelector(`[data-menu-custom-format="${this.slot}"]`)
      .classList
      .add('is-active');

    doc.querySelectorAll('[data-placeholder="default-name"]')
      .forEach((el) => {
        // eslint-disable-next-line no-param-reassign
        el.textContent = this.defaultName();
      });

    this.elInputName.placeholder = this.defaultName();
  }

  /**
   *
   * @param customFormat {CustomFormat}
   */
  load(customFormat) {
    this.elInputName.value = customFormat.name;
    this.elInputTemplate.value = customFormat.template;
    this.elShowInPopupMenu.checked = customFormat.showInPopupMenu;
    this.renderPreview();
  }

  /**
   * @return {CustomFormat}
   */
  current() {
    return new CustomFormat({
      slot: this.slot,
      name: this.elInputName.value,
      template: this.elInputTemplate.value,
      showInPopupMenu: this.elShowInPopupMenu.checked,
    });
  }

  renderPreview() {
    this.elInputTemplate.classList.remove('is-danger');
    this.elErrorTemplate.classList.add('is-hidden');
    this.elSave.disabled = true;

    const customFormat = this.current();

    try {
      this.elPreview.value = customFormat.render(UI.sampleInput);
      this.elSave.disabled = false;
    } catch (err) {
      console.error(err);
      this.elInputTemplate.classList.add('is-danger');
      this.elErrorTemplate.classList.remove('is-hidden');
      this.elPreview.value = '';
      this.elSave.disabled = true;
    }
  }

  defaultName() {
    return `Custom Format ${this.slot}`;
  }

  static get sampleInput() {
    return {
      links: [
        {
          title: 'Example 1',
          url: 'https://example.com/1',
          number: 1,
        },
        {
          title: 'Example 2',
          url: 'https://example.com/2',
          number: 2,
        },
        {
          title: 'Example 3',
          url: 'https://example.com/3',
          number: 3,
        },
      ],
    };
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const ui = new UI(document);
  const customFormat = await CustomFormatsStorage.get(ui.slot);
  ui.load(customFormat);

  ui.elSave.addEventListener('click', async () => {
    await CustomFormatsStorage.save(ui.slot, ui.current());
  });
});
