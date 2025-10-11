import type { Context } from '../lib/custom-format';
import CustomFormat from '../lib/custom-format';

function storageKeyOf(context: Context, slot: string, attribute: string): string {
  return `custom_formats.${context}.${slot}.${attribute}`;
}

export default {
  async get(context: Context, slot: string): Promise<CustomFormat> {
    const stored = await browser.storage.sync.get({
      [storageKeyOf(context, slot, 'name')]: '',
      [storageKeyOf(context, slot, 'template')]: '',
      [storageKeyOf(context, slot, 'show_in_menus')]: false,
    });

    return new CustomFormat({
      slot,
      context,
      name: stored[storageKeyOf(context, slot, 'name')] as string,
      template: stored[storageKeyOf(context, slot, 'template')] as string,
      showInMenus: stored[storageKeyOf(context, slot, 'show_in_menus')] as boolean,
    });
  },

  async list(context: Context): Promise<CustomFormat[]> {
    return Promise.all(['1', '2', '3', '4', '5'].map(slot => this.get(context, slot)));
  },

  async save(context: Context, slot: string, customFormat: CustomFormat): Promise<void> {
    const assignments = {
      [storageKeyOf(context, slot, 'name')]: customFormat.name,
      [storageKeyOf(context, slot, 'template')]: customFormat.template,
      [storageKeyOf(context, slot, 'show_in_menus')]: customFormat.showInMenus,
    };

    await browser.storage.sync.set(assignments);
    await this.touch();
  },

  async touch(): Promise<void> {
    await browser.storage.sync.set({ [this.KeyOfLastUpdate()]: new Date().getTime() });
  },

  KeyOfLastUpdate(): string {
    return 'custom_formats.updated_at';
  },
};
