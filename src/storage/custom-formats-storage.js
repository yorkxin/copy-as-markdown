import CustomFormat from '../lib/custom-format.js';

/**
 * @param {import('../lib/custom-format.js').Context} context
 * @param {string} slot
 * @param {string} attribute
 * @returns {string}
 */
function storageKeyOf(context, slot, attribute) {
  return `custom_formats.${context}.${slot}.${attribute}`;
}

export default {
  /**
   *
   * @param {import('../lib/custom-format.js').Context} context
   * @param {string} slot
   * @returns {Promise<CustomFormat>}
   */
  async get(context, slot) {
    const stored = await browser.storage.sync.get({
      [storageKeyOf(context, slot, 'name')]: '',
      [storageKeyOf(context, slot, 'template')]: '',
      [storageKeyOf(context, slot, 'show_in_menus')]: false,
    });

    return new CustomFormat({
      slot,
      context,
      name: stored[storageKeyOf(context, slot, 'name')],
      template: stored[storageKeyOf(context, slot, 'template')],
      showInMenus: stored[storageKeyOf(context, slot, 'show_in_menus')],
    });
  },

  /**
   * @param {import('../lib/custom-format.js').Context} context
   * @returns {Promise<CustomFormat[]>}
   */
  async list(context) {
    return Promise.all(['1', '2', '3', '4', '5'].map((slot) => this.get(context, slot)));
  },

  /**
   *
   * @param {import('../lib/custom-format.js').Context} context
   * @param {string} slot
   * @param {CustomFormat} customFormat
   * @returns {Promise<void>}
   */
  async save(context, slot, customFormat) {
    const assignments = {
      [storageKeyOf(context, slot, 'name')]: customFormat.name,
      [storageKeyOf(context, slot, 'template')]: customFormat.template,
      [storageKeyOf(context, slot, 'show_in_menus')]: customFormat.showInMenus,
    };

    await browser.storage.sync.set(assignments);
    await this.touch();
  },

  async touch() {
    await browser.storage.sync.set({ [this.KeyOfLastUpdate()]: new Date().getTime() });
  },

  KeyOfLastUpdate() {
    return 'custom_formats.updated_at';
  },
};
