import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadMarkdownSettings,
  readMarkdownSettings,
  resetMarkdownSettings,
  setSharedBulletListMarker,
} from '../src/lib/markdown-settings';
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

    it.each([
      ['indented', 'indented'],
      ['fenced', 'fenced'],
    ])('carries the legacy %s code-block choice into the selection converter options', async (legacy, expected) => {
      storage.data[LegacyMarkdownSettingKeys.codeBlock] = legacy;
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'plus';

      const { selection } = await loadMarkdownSettings();

      // The shape background.ts hands to Turndown for Copy Selection.
      expect({
        headingStyle: 'atx',
        bulletListMarker: selection.bulletListMarker,
        codeBlockStyle: selection.codeBlockStyle,
      }).toEqual({
        headingStyle: 'atx',
        bulletListMarker: '+',
        codeBlockStyle: expected,
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

  describe('setSharedBulletListMarker() — one control, two contexts', () => {
    it('points both contexts at the marker', async () => {
      await setSharedBulletListMarker('+');

      expect(storage.data['selection.markdown.bulletListMarker']).toBe('+');
      expect(storage.data['multipleLinks.markdown.bulletListMarker']).toBe('+');
    });

    it('cannot half-succeed and leave the contexts disagreeing', async () => {
      await setSharedBulletListMarker('*');
      storage.failNextSet = new Error('QUOTA_BYTES quota exceeded');

      await expect(setSharedBulletListMarker('+')).rejects.toThrow();

      // Both keys still hold the previous choice — no split behind one control.
      expect(storage.data['selection.markdown.bulletListMarker']).toBe('*');
      expect(storage.data['multipleLinks.markdown.bulletListMarker']).toBe('*');
    });
  });

  describe('resetMarkdownSettings() — the Markdown Style page reset', () => {
    it('restores every setting the page owns', async () => {
      storage.data['selection.markdown.bulletListMarker'] = '+';
      storage.data['selection.markdown.codeBlockStyle'] = 'indented';
      storage.data['multipleLinks.markdown.bulletListMarker'] = '*';
      storage.data['multipleLinks.markdown.tabGroupIndentation'] = 'tab';

      await resetMarkdownSettings();

      expect(await readMarkdownSettings()).toEqual({
        alwaysEscapeLinkBrackets: false,
        selection: { bulletListMarker: '-', codeBlockStyle: 'fenced' },
        multipleLinks: { bulletListMarker: '-', tabGroupIndentation: 'spaces' },
      });
    });

    it('leaves link-text escaping to the Advanced page', async () => {
      storage.data.linkTextAlwaysEscapeBrackets = true;

      await resetMarkdownSettings();

      expect(storage.data.linkTextAlwaysEscapeBrackets).toBe(true);
    });

    it('cannot reset some contexts and not others', async () => {
      storage.data['selection.markdown.bulletListMarker'] = '+';
      storage.data['multipleLinks.markdown.bulletListMarker'] = '*';
      storage.failNextRemove = new Error('storage unavailable');

      await expect(resetMarkdownSettings()).rejects.toThrow();

      expect(storage.data['selection.markdown.bulletListMarker']).toBe('+');
      expect(storage.data['multipleLinks.markdown.bulletListMarker']).toBe('*');
    });

    it('does not let a legacy value retained by a failed cleanup resurrect', async () => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';
      storage.failNextRemove = new Error('storage unavailable');
      await loadMarkdownSettings();
      // The failed cleanup left the legacy key in place for a later retry.
      expect(storage.data[LegacyMarkdownSettingKeys.unorderedList]).toBe('asterisk');

      await resetMarkdownSettings();

      // The next startup must not migrate the old value back over the defaults.
      expect(await loadMarkdownSettings()).toEqual({
        alwaysEscapeLinkBrackets: false,
        selection: { bulletListMarker: '-', codeBlockStyle: 'fenced' },
        multipleLinks: { bulletListMarker: '-', tabGroupIndentation: 'spaces' },
      });
      expect(storage.data[LegacyMarkdownSettingKeys.unorderedList]).toBeUndefined();
    });

    it('leaves custom formats alone', async () => {
      storage.data['custom_formats.multiple-links.1.name'] = 'My Format';
      storage.data['custom_formats.multiple-links.1.template'] = '{{title}}';

      await resetMarkdownSettings();

      expect(storage.data['custom_formats.multiple-links.1.name']).toBe('My Format');
      expect(storage.data['custom_formats.multiple-links.1.template']).toBe('{{title}}');
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
