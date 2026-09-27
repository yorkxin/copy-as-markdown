import CustomFormatsStorage from '../storage/custom-formats-storage.js';
import type { BuiltInStyleKey, BuiltInStyleSettings } from './built-in-style-settings.js';
import BuiltInStyleSettingsStorage from './built-in-style-settings.js';
import type CustomFormat from './custom-format.js';
import type { Context } from './custom-format.js';
import { Contexts } from './custom-format.js';

export interface MenuVisibility {
  builtIn: BuiltInStyleSettings;
  customFormats: CustomFormat[];
}

/** Reset changes visibility only; custom format names and templates are preserved. */
export default {
  async getAll(): Promise<MenuVisibility> {
    const [builtIn, ...customFormatsByContext] = await Promise.all([
      BuiltInStyleSettingsStorage.getAll(),
      ...Contexts.map(context => CustomFormatsStorage.list(context)),
    ] as const);

    return { builtIn, customFormats: customFormatsByContext.flat() };
  },

  async setBuiltIn(key: BuiltInStyleKey, visible: boolean): Promise<void> {
    await BuiltInStyleSettingsStorage.set(key, visible);
  },

  async setCustomFormat(context: Context, slot: string, visible: boolean): Promise<void> {
    await CustomFormatsStorage.setShowInMenus(context, slot, visible);
  },

  async reset(): Promise<void> {
    await BuiltInStyleSettingsStorage.reset();
    await CustomFormatsStorage.hideAllFromMenus();
  },
};
