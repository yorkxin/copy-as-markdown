import CustomFormatsStorage from '../storage/custom-formats-storage.js';
import type { BuiltInStyleKey, BuiltInStyleSettings } from './built-in-style-settings.js';
import BuiltInStyleSettingsStorage from './built-in-style-settings.js';
import type CustomFormat from './custom-format.js';
import type { Context } from './custom-format.js';
import { Contexts } from './custom-format.js';

export interface MenuVisibility {
  builtIn: BuiltInStyleSettings;
  /** Every custom format across all contexts, in options-navigation order. */
  customFormats: CustomFormat[];
}

/**
 * Menu composition owned by the Menu Commands page: which built-in commands and
 * which custom formats appear in the popup and context menus.
 *
 * Reset is deliberately visibility-only. It removes the stored visibility flags
 * so both kinds fall back to their defaults — built-ins visible, custom formats
 * hidden — and never reads or writes a custom format's name or template.
 */
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
