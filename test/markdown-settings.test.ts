import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MarkdownSettings } from '../src/lib/markdown-settings';
import {
  loadMarkdownSettings,
  readMarkdownSettings,
  resetMultipleLinksSettings,
  resetSelectionSettings,
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

  describe('page-owned resets', () => {
    it('lets the Copy Selection reset restore only its own settings', async () => {
      storage.data['selection.markdown.bulletListMarker'] = '+';
      storage.data['selection.markdown.codeBlockStyle'] = 'indented';
      storage.data['multipleLinks.markdown.bulletListMarker'] = '*';
      storage.data['multipleLinks.markdown.tabGroupIndentation'] = 'tab';
      storage.data.linkTextAlwaysEscapeBrackets = true;
      storage.data['custom_formats.multiple-links.1.name'] = 'My Format';
      storage.data['custom_formats.multiple-links.1.template'] = '{{title}}';

      await resetSelectionSettings();

      expect(await readMarkdownSettings()).toEqual({
        alwaysEscapeLinkBrackets: true,
        selection: { bulletListMarker: '-', codeBlockStyle: 'fenced' },
        multipleLinks: { bulletListMarker: '*', tabGroupIndentation: 'tab' },
      });
      expect(storage.data['custom_formats.multiple-links.1.name']).toBe('My Format');
      expect(storage.data['custom_formats.multiple-links.1.template']).toBe('{{title}}');
    });

    it('lets the Multiple Links reset restore only its own settings', async () => {
      storage.data['selection.markdown.bulletListMarker'] = '+';
      storage.data['selection.markdown.codeBlockStyle'] = 'indented';
      storage.data['multipleLinks.markdown.bulletListMarker'] = '*';
      storage.data['multipleLinks.markdown.tabGroupIndentation'] = 'tab';
      storage.data.linkTextAlwaysEscapeBrackets = true;

      await resetMultipleLinksSettings();

      expect(await readMarkdownSettings()).toEqual({
        alwaysEscapeLinkBrackets: true,
        selection: { bulletListMarker: '+', codeBlockStyle: 'indented' },
        multipleLinks: { bulletListMarker: '-', tabGroupIndentation: 'spaces' },
      });
    });

    it.each([
      ['Copy Selection', resetSelectionSettings, (s: MarkdownSettings) => s.selection.bulletListMarker],
      ['Multiple Links', resetMultipleLinksSettings, (s: MarkdownSettings) => s.multipleLinks.bulletListMarker],
    ])('keeps a %s reset final even when a legacy key survived a failed cleanup', async (_context, reset, markerOf) => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';
      storage.failNextRemove = new Error('storage unavailable');
      await loadMarkdownSettings();
      // The failed cleanup left the legacy key in place for a later retry, but
      // both contexts already hold their migrated copy.
      expect(storage.data[LegacyMarkdownSettingKeys.unorderedList]).toBe('asterisk');

      await reset();

      // Spent everywhere, so the reset retires it: the next startup cannot
      // migrate it back over the default the user just asked for.
      expect(storage.data[LegacyMarkdownSettingKeys.unorderedList]).toBeUndefined();
      expect(markerOf(await loadMarkdownSettings())).toBe('-');
    });

    it.each([
      [
        'Copy Selection',
        resetSelectionSettings,
        (s: MarkdownSettings) => s.selection.bulletListMarker,
        (s: MarkdownSettings) => s.multipleLinks.bulletListMarker,
      ],
      [
        'Multiple Links',
        resetMultipleLinksSettings,
        (s: MarkdownSettings) => s.multipleLinks.bulletListMarker,
        (s: MarkdownSettings) => s.selection.bulletListMarker,
      ],
    ])(
      'does not spend the shared legacy marker when a %s reset follows a failed migration write',
      async (_context, reset, ownMarkerOf, siblingMarkerOf) => {
        storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';
        storage.failNextSet = new Error('QUOTA_BYTES quota exceeded');
        await loadMarkdownSettings();
        // Nothing materialized: the legacy key is still both contexts' only copy.
        expect(storage.data['selection.markdown.bulletListMarker']).toBeUndefined();
        expect(storage.data['multipleLinks.markdown.bulletListMarker']).toBeUndefined();

        await reset();

        // The sibling's preference survives the retry...
        const migrated = await loadMarkdownSettings();
        expect(siblingMarkerOf(migrated)).toBe('*');
        // ...while the reset context keeps the default it was just given.
        expect(ownMarkerOf(migrated)).toBe('-');
      },
    );

    it('keeps the shared legacy marker for the sibling when the reset cannot migrate it', async () => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';
      storage.data[LegacyMarkdownSettingKeys.codeBlock] = 'indented';
      // The migration the reset runs first cannot materialize either context.
      storage.failNextSet = new Error('QUOTA_BYTES quota exceeded');

      await resetSelectionSettings();

      // Still the only copy of the sibling's preference, so it stays...
      expect(storage.data[LegacyMarkdownSettingKeys.unorderedList]).toBe('asterisk');
      // ...and Copy Selection records its defaults instead, which a later
      // migration will not overwrite.
      expect(storage.data['selection.markdown.bulletListMarker']).toBe('-');
      expect(storage.data['selection.markdown.codeBlockStyle']).toBe('fenced');

      const migrated = await loadMarkdownSettings();
      expect(migrated.multipleLinks.bulletListMarker).toBe('*');
      expect(migrated.selection).toEqual({ bulletListMarker: '-', codeBlockStyle: 'fenced' });
    });

    it('does not spend the shared legacy marker for a sibling value it cannot read', async () => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';
      // Written by a newer version: present, but not a marker this version knows.
      storage.data['multipleLinks.markdown.bulletListMarker'] = 'em-dash';

      await resetSelectionSettings();

      expect(storage.data[LegacyMarkdownSettingKeys.unorderedList]).toBe('asterisk');
      expect(storage.data['multipleLinks.markdown.bulletListMarker']).toBe('em-dash');
      expect((await readMarkdownSettings()).selection.bulletListMarker).toBe('-');
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
