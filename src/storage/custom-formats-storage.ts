import type { Context } from '../lib/custom-format.js';
import CustomFormat, { Contexts, Slots } from '../lib/custom-format.js';

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
    return Promise.all(Slots.map(slot => this.get(context, slot)));
  },

  /**
   * Write only the menu-visibility flag, leaving the name and template exactly
   * as stored. `save()` would rewrite all three from an in-memory copy.
   */
  async setShowInMenus(context: Context, slot: string, showInMenus: boolean): Promise<void> {
    await browser.storage.sync.set({
      [storageKeyOf(context, slot, 'show_in_menus')]: showInMenus,
    });
    await this.touch();
  },

  /**
   * Drop every menu-visibility flag, which restores the stored default of
   * hidden. Names and templates are never read or written here.
   */
  async hideAllFromMenus(): Promise<void> {
    const keys = Contexts.flatMap(
      context => Slots.map(slot => storageKeyOf(context, slot, 'show_in_menus')),
    );

    await browser.storage.sync.remove(keys);
    await this.touch();
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
