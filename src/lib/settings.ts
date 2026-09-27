const SKLinkTextAlwaysEscapeBrackets = 'linkTextAlwaysEscapeBrackets';

interface Settings {
  alwaysEscapeLinkBrackets: boolean;
}

/** Settings shared by every output context; context-specific Markdown styles live elsewhere. */
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

  /** Removes the key so browser.storage.get supplies its default; no legacy key is retired. */
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
