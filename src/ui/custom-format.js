// eslint-disable-next-line max-classes-per-file
import CustomFormatsStorage from '../storage/custom-formats-storage.js';
import CustomFormat from '../lib/custom-format.js';

class UI {
  /**
   *
   * @param {Document} doc
   */
  constructor(doc) {
    const params = new URLSearchParams(document.location.search);
    /** @property {string} */
    this.slot = params.get('slot');
    /** @property {import('../lib/custom-format.js').Context} */
    this.context = params.get('context');
    /** @property {Object} */
    this.sampleInput = {};
    const placeholder = doc.querySelector("[data-placeholder='context-in-header']");
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

    /** @property {HTMLInputElement} */
    this.elInputName = /** @type {HTMLInputElement} */ (doc.getElementById('input-name'));
    /** @property {HTMLInputElement} */
    this.elInputTemplate = /** @type {HTMLInputElement} */ (doc.getElementById('input-template'));
    /** @property {HTMLInputElement} */
    this.elShowInMenus = /** @type {HTMLInputElement} */ (doc.getElementById('input-show-in-menus'));
    /** @property {HTMLTextAreaElement} */
    this.elPreview = /** @type {HTMLTextAreaElement} */ (doc.getElementById('preview'));
    /** @property {HTMLDivElement} */
    this.elErrorTemplate = /** @type {HTMLDivElement} */ (doc.getElementById('error-template'));
    /** @property {HTMLButtonElement} */
    this.elSave = /** @type {HTMLButtonElement} */ (doc.getElementById('save'));
    // eslint-disable-next-line no-param-reassign
    doc.getElementById('sample-input').textContent = JSON.stringify(this.sampleInput, null, 2);

    this.elInputTemplate.addEventListener('input', () => {
      this.renderPreview();
    });

    this.elInputTemplate.addEventListener('change', () => {
      this.renderPreview();
    });

    doc.querySelectorAll('[data-placeholder="default-name"]')
      .forEach((el) => {
        // eslint-disable-next-line no-param-reassign
        el.textContent = this.defaultName();
      });

    this.elInputName.placeholder = this.defaultName();
  }

  /**
   *
   * @param {CustomFormat} customFormat
   */
  load(customFormat) {
    this.elInputName.value = customFormat.name === '' ? this.defaultName() : customFormat.name;
    this.elInputTemplate.value = customFormat.template;
    this.elShowInMenus.checked = customFormat.showInMenus;
    this.renderPreview();
  }

  /**
   * @returns {CustomFormat}
   */
  current() {
    return new CustomFormat({
      slot: this.slot,
      context: this.context,
      name: this.elInputName.value,
      template: this.elInputTemplate.value,
      showInMenus: this.elShowInMenus.checked,
    });
  }

  /**
   * @returns {void}
   */
  renderPreview() {
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

  /**
   * @returns {string}
   */
  defaultName() {
    return `Custom Format ${this.slot}`;
  }

  /**
   * @returns {Object}
   */
  static get sampleInputForOneLink() {
    return { title: 'Example 1', url: 'https://example.com/1' };
  }

  /**
   * @returns {Object}
   */
  static get sampleInputForTabs() {
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
          title: 'Example 1', url: 'https://example.com/1', isGroup: false, number: 1, links: [],
        },
        {
          title: 'Example 2', url: 'https://example.com/2', isGroup: false, number: 2, links: [],
        },
        {
          title: 'Group 1',
          url: null,
          isGroup: true,
          number: 3,
          links: [
            {
              title: 'Example 3', url: 'https://example.com/3', isGroup: false, number: 1, links: [],
            },
            {
              title: 'Example 4', url: 'https://example.com/4', isGroup: false, number: 2, links: [],
            },
            {
              title: 'Example 5', url: 'https://example.com/5', isGroup: false, number: 3, links: [],
            },
          ],
        },
        {
          title: 'Example 6', url: 'https://example.com/6', isGroup: false, number: 4, links: [],
        },
        {
          title: 'Example 7', url: 'https://example.com/7', isGroup: false, number: 5, links: [],
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
