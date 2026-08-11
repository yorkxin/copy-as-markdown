import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadMarkdownSettings, readMarkdownSettings } from '../src/lib/markdown-settings';
import { LegacyMarkdownSettingKeys } from '../src/lib/markdown-settings-migration';
import type { FakeSyncStorage } from './support/fake-sync-storage';
import { createFakeSyncStorage } from './support/fake-sync-storage';

describe('markdown settings', () => {
  let storage: FakeSyncStorage;

  beforeEach(() => {
    storage = createFakeSyncStorage();
    storage.install();
  });

  afterEach(() => {
    storage.uninstall();
  });

  describe('loadMarkdownSettings() — the startup path', () => {
    it('honors a legacy profile without the settings page ever being opened', async () => {
      // Exactly what an upgrading user's storage looks like: legacy keys only.
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';
      storage.data[LegacyMarkdownSettingKeys.codeBlock] = 'indented';
      storage.data[LegacyMarkdownSettingKeys.tabGroupIndentation] = 'tab';
      storage.data.linkTextAlwaysEscapeBrackets = true;

      const settings = await loadMarkdownSettings();

      expect(settings).toEqual({
        alwaysEscapeLinkBrackets: true,
        selection: { bulletListMarker: '*', codeBlockStyle: 'indented' },
        multipleLinks: { bulletListMarker: '*', tabGroupIndentation: 'tab' },
      });
    });

    it('retires the legacy keys as it goes', async () => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'plus';

      await loadMarkdownSettings();

      expect(storage.data[LegacyMarkdownSettingKeys.unorderedList]).toBeUndefined();
      expect(storage.data['selection.markdown.bulletListMarker']).toBe('+');
    });

    it('gives a clean install the current defaults', async () => {
      expect(await loadMarkdownSettings()).toEqual({
        alwaysEscapeLinkBrackets: false,
        selection: { bulletListMarker: '-', codeBlockStyle: 'fenced' },
        multipleLinks: { bulletListMarker: '-', tabGroupIndentation: 'spaces' },
      });
    });

    it('falls back to the defaults when the migration write fails', async () => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';
      storage.failNextSet = new Error('QUOTA_BYTES quota exceeded');

      const settings = await loadMarkdownSettings();

      expect(settings.multipleLinks.bulletListMarker).toBe('-');
      // The legacy key survives, so the next startup can still preserve it.
      expect(storage.data[LegacyMarkdownSettingKeys.unorderedList]).toBe('asterisk');
      expect((await loadMarkdownSettings()).multipleLinks.bulletListMarker).toBe('*');
    });
  });

  describe('readMarkdownSettings() — the storage-change path', () => {
    it('does not migrate', async () => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';

      const settings = await readMarkdownSettings();

      expect(settings.multipleLinks.bulletListMarker).toBe('-');
      expect(storage.data[LegacyMarkdownSettingKeys.unorderedList]).toBe('asterisk');
    });

    it('reads what each context owns', async () => {
      storage.data['selection.markdown.bulletListMarker'] = '+';
      storage.data['multipleLinks.markdown.bulletListMarker'] = '*';

      const settings = await readMarkdownSettings();

      expect(settings.selection.bulletListMarker).toBe('+');
      expect(settings.multipleLinks.bulletListMarker).toBe('*');
    });
  });
});
