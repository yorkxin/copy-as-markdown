const SKLinkTextAlwaysEscapeBrackets = 'linkTextAlwaysEscapeBrackets';

interface Settings {
  alwaysEscapeLinkBrackets: boolean;
}

/**
 * Settings that are still shared across output contexts.
 *
 * Link-text escaping applies to every generated link, so it keeps its original
 * unscoped key. The Markdown style preferences that used to live here now
 * belong to `selection-settings.ts` and `multiple-links-settings.ts`.
 */
export default {
  SKLinkTextAlwaysEscapeBrackets,

  get defaultSettings(): Record<string, unknown> {
    return {
      [SKLinkTextAlwaysEscapeBrackets]: false,
    };
  },

  get keys(): string[] {
    return Object.keys(this.defaultSettings);
  },

  async setLinkTextAlwaysEscapeBrackets(value: boolean): Promise<void> {
    await browser.storage.sync.set({
      [SKLinkTextAlwaysEscapeBrackets]: value,
    });
  },

  /**
   * Restore the default by removing the key.
   *
   * Unlike the context-owned resets, this preference has no legacy key of its
   * own to clear alongside it — it was never renamed.
   */
  async reset(): Promise<void> {
    await browser.storage.sync.remove(this.keys);
  },

  async getAll(): Promise<Settings> {
    const all = await browser.storage.sync.get(this.defaultSettings);

    return {
      alwaysEscapeLinkBrackets: all[SKLinkTextAlwaysEscapeBrackets] as boolean,
    };
  },
};
