import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MarkdownSettings } from '../src/lib/markdown-settings';
import {
  loadMarkdownSettings,
  markdownSettingsKeys,
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
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';
      storage.data[LegacyMarkdownSettingKeys.codeBlock] = 'indented';
      storage.data[LegacyMarkdownSettingKeys.tabGroupIndentation] = 'tab';
      storage.data.linkTextAlwaysEscapeBrackets = true;

      const settings = await loadMarkdownSettings();

      expect(settings).toEqual({
        alwaysEscapeLinkBrackets: true,
        selection: { bulletListMarker: '*', codeBlockStyle: 'indented', emDelimiter: '_', strongDelimiter: '**', headingStyle: 'atx', fence: '```', linkStyle: 'inlined', linkReferenceStyle: 'full' },
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
        selection: { bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '_', strongDelimiter: '**', headingStyle: 'atx', fence: '```', linkStyle: 'inlined', linkReferenceStyle: 'full' },
        multipleLinks: { bulletListMarker: '-', tabGroupIndentation: 'spaces' },
      });
    });

    it('falls back to the defaults when the migration write fails', async () => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';
      storage.failNextSet = new Error('QUOTA_BYTES quota exceeded');

      const settings = await loadMarkdownSettings();

      expect(settings.multipleLinks.bulletListMarker).toBe('-');
      expect(storage.data[LegacyMarkdownSettingKeys.unorderedList]).toBe('asterisk');
      expect((await loadMarkdownSettings()).multipleLinks.bulletListMarker).toBe('*');
    });
  });

  describe('page-owned resets', () => {
    it('lets the Copy Selection reset restore only its own settings', async () => {
      storage.data['selection.markdown.bulletListMarker'] = '+';
      storage.data['selection.markdown.codeBlockStyle'] = 'indented';
      storage.data['selection.markdown.emDelimiter'] = '*';
      storage.data['selection.markdown.strongDelimiter'] = '__';
      storage.data['selection.markdown.headingStyle'] = 'setext';
      storage.data['selection.markdown.fence'] = '~~~';
      storage.data['selection.markdown.linkStyle'] = 'referenced';
      storage.data['selection.markdown.linkReferenceStyle'] = 'shortcut';
      storage.data['multipleLinks.markdown.bulletListMarker'] = '*';
      storage.data['multipleLinks.markdown.tabGroupIndentation'] = 'tab';
      storage.data.linkTextAlwaysEscapeBrackets = true;
      storage.data['custom_formats.multiple-links.1.name'] = 'My Format';
      storage.data['custom_formats.multiple-links.1.template'] = '{{title}}';

      await resetSelectionSettings();

      expect(await readMarkdownSettings()).toEqual({
        alwaysEscapeLinkBrackets: true,
        selection: { bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '_', strongDelimiter: '**', headingStyle: 'atx', fence: '```', linkStyle: 'inlined', linkReferenceStyle: 'full' },
        multipleLinks: { bulletListMarker: '*', tabGroupIndentation: 'tab' },
      });
      expect(storage.data['custom_formats.multiple-links.1.name']).toBe('My Format');
      expect(storage.data['custom_formats.multiple-links.1.template']).toBe('{{title}}');
    });

    it('lets the Multiple Links reset restore only its own settings', async () => {
      storage.data['selection.markdown.bulletListMarker'] = '+';
      storage.data['selection.markdown.codeBlockStyle'] = 'indented';
      storage.data['selection.markdown.emDelimiter'] = '*';
      storage.data['selection.markdown.strongDelimiter'] = '__';
      storage.data['selection.markdown.headingStyle'] = 'setext';
      storage.data['selection.markdown.fence'] = '~~~';
      storage.data['selection.markdown.linkStyle'] = 'referenced';
      storage.data['selection.markdown.linkReferenceStyle'] = 'shortcut';
      storage.data['multipleLinks.markdown.bulletListMarker'] = '*';
      storage.data['multipleLinks.markdown.tabGroupIndentation'] = 'tab';
      storage.data.linkTextAlwaysEscapeBrackets = true;

      await resetMultipleLinksSettings();

      expect(await readMarkdownSettings()).toEqual({
        alwaysEscapeLinkBrackets: true,
        selection: { bulletListMarker: '+', codeBlockStyle: 'indented', emDelimiter: '*', strongDelimiter: '__', headingStyle: 'setext', fence: '~~~', linkStyle: 'referenced', linkReferenceStyle: 'shortcut' },
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
      expect(storage.data[LegacyMarkdownSettingKeys.unorderedList]).toBe('asterisk');

      await reset();

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
        expect(storage.data['selection.markdown.bulletListMarker']).toBeUndefined();
        expect(storage.data['multipleLinks.markdown.bulletListMarker']).toBeUndefined();

        await reset();

        const migrated = await loadMarkdownSettings();
        expect(siblingMarkerOf(migrated)).toBe('*');
        expect(ownMarkerOf(migrated)).toBe('-');
      },
    );

    it('keeps the shared legacy marker for the sibling when the reset cannot migrate it', async () => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';
      storage.data[LegacyMarkdownSettingKeys.codeBlock] = 'indented';
      storage.data['selection.markdown.emDelimiter'] = '*';
      storage.data['selection.markdown.strongDelimiter'] = '__';
      storage.data['selection.markdown.headingStyle'] = 'setext';
      storage.data['selection.markdown.fence'] = '~~~';
      storage.data['selection.markdown.linkStyle'] = 'referenced';
      storage.data['selection.markdown.linkReferenceStyle'] = 'shortcut';
      storage.failNextSet = new Error('QUOTA_BYTES quota exceeded');

      await resetSelectionSettings();

      expect(storage.data[LegacyMarkdownSettingKeys.unorderedList]).toBe('asterisk');
      expect(storage.data['selection.markdown.bulletListMarker']).toBe('-');
      expect(storage.data['selection.markdown.codeBlockStyle']).toBe('fenced');
      expect(storage.data['selection.markdown.linkStyle']).toBe('inlined');
      expect(storage.data['selection.markdown.linkReferenceStyle']).toBe('full');

      const migrated = await loadMarkdownSettings();
      expect(migrated.multipleLinks.bulletListMarker).toBe('*');
      expect(migrated.selection).toEqual({ bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '_', strongDelimiter: '**', headingStyle: 'atx', fence: '```', linkStyle: 'inlined', linkReferenceStyle: 'full' });
    });

    it('does not spend the shared legacy marker for a sibling value it cannot read', async () => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';
      storage.data['multipleLinks.markdown.bulletListMarker'] = 'em-dash';

      await resetSelectionSettings();

      expect(storage.data[LegacyMarkdownSettingKeys.unorderedList]).toBe('asterisk');
      expect(storage.data['multipleLinks.markdown.bulletListMarker']).toBe('em-dash');
      expect((await readMarkdownSettings()).selection.bulletListMarker).toBe('-');
    });
  });

  describe('readMarkdownSettings() — the storage-change path', () => {
    it('watches both link settings for background refresh', () => {
      expect(markdownSettingsKeys).toContain('selection.markdown.linkStyle');
      expect(markdownSettingsKeys).toContain('selection.markdown.linkReferenceStyle');
    });

    it('does not migrate', async () => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';

      const settings = await readMarkdownSettings();

      expect(settings.multipleLinks.bulletListMarker).toBe('-');
      expect(storage.data[LegacyMarkdownSettingKeys.unorderedList]).toBe('asterisk');
    });

    it('reads what each context owns', async () => {
      storage.data['selection.markdown.bulletListMarker'] = '+';
      storage.data['selection.markdown.linkStyle'] = 'referenced';
      storage.data['selection.markdown.linkReferenceStyle'] = 'collapsed';
      storage.data['multipleLinks.markdown.bulletListMarker'] = '*';

      const settings = await readMarkdownSettings();

      expect(settings.selection.bulletListMarker).toBe('+');
      expect(settings.selection.linkStyle).toBe('referenced');
      expect(settings.selection.linkReferenceStyle).toBe('collapsed');
      expect(settings.multipleLinks.bulletListMarker).toBe('*');
    });
  });
});
