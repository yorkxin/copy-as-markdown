export const CleanupSettingKeys = {
  removeImages: 'selection.cleanup.removeImages',
  removeLinks: 'selection.cleanup.removeLinks',
  cleanChatExport: 'selection.cleanup.cleanChatExport',
} as const;

export interface CleanupSettings {
  removeImages: boolean;
  removeLinks: boolean;
  cleanChatExport: boolean;
}

export const CleanupSettingDefaults: CleanupSettings = {
  removeImages: false,
  removeLinks: false,
  cleanChatExport: false,
};

/** Optional post-processing for Copy Selection; kept apart from Markdown syntax settings. */
export default {
  keys: Object.values(CleanupSettingKeys) as string[],
  defaultSettings: CleanupSettingDefaults,

  /** Non-boolean stored values fall back to defaults without being rewritten. */
  async getAll(): Promise<CleanupSettings> {
    const stored = await browser.storage.sync.get(this.keys);
    const read = (name: keyof CleanupSettings): boolean => {
      const value = stored[CleanupSettingKeys[name]];
      return typeof value === 'boolean' ? value : CleanupSettingDefaults[name];
    };
    return {
      removeImages: read('removeImages'),
      removeLinks: read('removeLinks'),
      cleanChatExport: read('cleanChatExport'),
    };
  },

  async set(name: keyof CleanupSettings, value: boolean): Promise<void> {
    await browser.storage.sync.set({ [CleanupSettingKeys[name]]: value });
  },

  async reset(): Promise<void> {
    await browser.storage.sync.remove(this.keys);
  },
};
