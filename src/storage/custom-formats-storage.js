import CustomFormat from '../lib/custom-format.js';

function storageKeyOf(slot, attribute) {
  return `custom_formats.${slot}.${attribute}`;
}

export default {
  /**
   *
   * @param slot {string}
   * @returns {Promise<CustomFormat>}
   */
  async get(slot) {
    const stored = await browser.storage.sync.get({
      [storageKeyOf(slot, 'name')]: '',
      [storageKeyOf(slot, 'template')]: '',
      [storageKeyOf(slot, 'show_in_popup_menu')]: false,
    });

    return new CustomFormat({
      slot,
      name: stored[storageKeyOf(slot, 'name')],
      template: stored[storageKeyOf(slot, 'template')],
      showInPopupMenu: stored[storageKeyOf(slot, 'show_in_popup_menu')],
    });
  },

  /**
   *
   * @returns {Promise<CustomFormat[]>}
   */
  async list() {
    return Promise.all(['1', '2', '3', '4', '5'].map((slot) => this.get(slot)));
  },

  /**
   *
   * @param slot {string}
   * @param customFormat {CustomFormat}
   * @returns {Promise<void>}
   */
  async save(slot, customFormat) {
    const assignments = {
      [storageKeyOf(slot, 'name')]: customFormat.name,
      [storageKeyOf(slot, 'template')]: customFormat.template,
      [storageKeyOf(slot, 'show_in_popup_menu')]: customFormat.showInPopupMenu,
    };

    await browser.storage.sync.set(assignments);
  },
};
