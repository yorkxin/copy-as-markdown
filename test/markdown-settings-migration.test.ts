import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Markdown from '../src/lib/markdown';
import {
  LegacyMarkdownSettingKeys,
  migrateMarkdownSettings,
} from '../src/lib/markdown-settings-migration';
import MultipleLinksSettings from '../src/lib/multiple-links-settings';
import SelectionSettings from '../src/lib/selection-settings';
import type { FakeSyncStorage } from './support/fake-sync-storage';
import { createFakeSyncStorage } from './support/fake-sync-storage';

const SelectionBulletKey = 'selection.markdown.bulletListMarker';
const SelectionCodeBlockKey = 'selection.markdown.codeBlockStyle';
const MultipleLinksBulletKey = 'multipleLinks.markdown.bulletListMarker';
const MultipleLinksIndentationKey = 'multipleLinks.markdown.tabGroupIndentation';

describe('markdown settings migration', () => {
  let storage: FakeSyncStorage;

  beforeEach(() => {
    storage = createFakeSyncStorage();
    storage.install();
  });

  afterEach(() => {
    storage.uninstall();
  });

  describe('clean install', () => {
    it('writes nothing when there is no legacy value to preserve', async () => {
      const result = await migrateMarkdownSettings();

      expect(result.status).toBe('skipped');
      expect(storage.data).toEqual({});
    });

    it('leaves both contexts on the current defaults', async () => {
      await migrateMarkdownSettings();

      expect(await SelectionSettings.getAll()).toEqual({
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
      });
      expect(await MultipleLinksSettings.getAll()).toEqual({
        bulletListMarker: '-',
        tabGroupIndentation: 'spaces',
      });
    });
  });

  describe('legacy unordered list mapping', () => {
    it.each([
      ['dash', '-'],
      ['asterisk', '*'],
      ['plus', '+'],
    ])('maps %s to %s for both contexts', async (legacy, marker) => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = legacy;

      await migrateMarkdownSettings();

      expect(storage.data[SelectionBulletKey]).toBe(marker);
      expect(storage.data[MultipleLinksBulletKey]).toBe(marker);
    });
  });

  it('migrates code block style and tab group indentation to their owning contexts', async () => {
    storage.data[LegacyMarkdownSettingKeys.codeBlock] = 'indented';
    storage.data[LegacyMarkdownSettingKeys.tabGroupIndentation] = 'tab';

    await migrateMarkdownSettings();

    expect(storage.data[SelectionCodeBlockKey]).toBe('indented');
    expect(storage.data[MultipleLinksIndentationKey]).toBe('tab');
  });

  it('removes the legacy keys once every target is written', async () => {
    storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'plus';
    storage.data[LegacyMarkdownSettingKeys.codeBlock] = 'indented';
    storage.data[LegacyMarkdownSettingKeys.tabGroupIndentation] = 'tab';

    const result = await migrateMarkdownSettings();

    expect(result.status).toBe('migrated');
    expect(Object.keys(storage.data).sort()).toEqual([
      MultipleLinksBulletKey,
      MultipleLinksIndentationKey,
      SelectionBulletKey,
      SelectionCodeBlockKey,
    ].sort());
  });

  it('leaves unrelated legacy settings alone', async () => {
    storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';
    storage.data.linkTextAlwaysEscapeBrackets = true;

    await migrateMarkdownSettings();

    expect(storage.data.linkTextAlwaysEscapeBrackets).toBe(true);
  });

  describe('missing and invalid legacy values', () => {
    it('falls back to the default for a legacy key that was never set', async () => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';

      await migrateMarkdownSettings();

      expect(storage.data[SelectionCodeBlockKey]).toBe('fenced');
      expect(storage.data[MultipleLinksIndentationKey]).toBe('spaces');
    });

    it('falls back to the default for an unrecognized legacy value', async () => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'circle';
      storage.data[LegacyMarkdownSettingKeys.codeBlock] = 'html';
      storage.data[LegacyMarkdownSettingKeys.tabGroupIndentation] = 'em-space';

      await migrateMarkdownSettings();

      expect(storage.data[SelectionBulletKey]).toBe('-');
      expect(storage.data[MultipleLinksBulletKey]).toBe('-');
      expect(storage.data[SelectionCodeBlockKey]).toBe('fenced');
      expect(storage.data[MultipleLinksIndentationKey]).toBe('spaces');
    });
  });

  describe('precedence of already-migrated values', () => {
    it('keeps a valid new value and populates only the missing ones', async () => {
      storage.data[SelectionBulletKey] = '+';
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';

      await migrateMarkdownSettings();

      expect(storage.data[SelectionBulletKey]).toBe('+');
      expect(storage.data[MultipleLinksBulletKey]).toBe('*');
    });

    it('does not rewrite an already-present but invalid new value', async () => {
      storage.data[SelectionCodeBlockKey] = 'from-the-future';
      storage.data[LegacyMarkdownSettingKeys.codeBlock] = 'indented';

      await migrateMarkdownSettings();

      expect(storage.data[SelectionCodeBlockKey]).toBe('from-the-future');
    });

    it('keeps the legacy keys while a target holds an unreadable value', async () => {
      storage.data[SelectionCodeBlockKey] = 'from-the-future';
      storage.data[LegacyMarkdownSettingKeys.codeBlock] = 'indented';
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';

      const result = await migrateMarkdownSettings();

      expect(result.status).toBe('legacy-retained');
      expect(storage.data[LegacyMarkdownSettingKeys.codeBlock]).toBe('indented');
      expect(storage.data[LegacyMarkdownSettingKeys.unorderedList]).toBe('asterisk');
      // The readable targets are still populated, so nothing is left waiting.
      expect(storage.data[SelectionBulletKey]).toBe('*');
      expect(storage.data[MultipleLinksBulletKey]).toBe('*');
    });

    it('finishes once the unreadable target becomes readable again', async () => {
      storage.data[SelectionCodeBlockKey] = 'from-the-future';
      storage.data[LegacyMarkdownSettingKeys.codeBlock] = 'indented';
      await migrateMarkdownSettings();

      await SelectionSettings.setCodeBlockStyle('indented');
      const result = await migrateMarkdownSettings();

      expect(result.status).toBe('migrated');
      expect(storage.data[LegacyMarkdownSettingKeys.codeBlock]).toBeUndefined();
      expect(storage.data[SelectionCodeBlockKey]).toBe('indented');
    });

    it('is a no-op when run again after a user changed a migrated value', async () => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';
      await migrateMarkdownSettings();

      await SelectionSettings.setBulletListMarker('+');
      const result = await migrateMarkdownSettings();

      expect(result.status).toBe('skipped');
      expect(storage.data[SelectionBulletKey]).toBe('+');
      expect(storage.data[MultipleLinksBulletKey]).toBe('*');
    });
  });

  describe('failure handling', () => {
    it('retains the legacy keys when writing the targets fails', async () => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';
      storage.failNextSet = new Error('QUOTA_BYTES quota exceeded');

      const result = await migrateMarkdownSettings();

      expect(result.status).toBe('write-failed');
      expect(storage.data[LegacyMarkdownSettingKeys.unorderedList]).toBe('asterisk');
      expect(storage.data[SelectionBulletKey]).toBeUndefined();
    });

    it('completes on a later retry after a failed write', async () => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';
      storage.failNextSet = new Error('QUOTA_BYTES quota exceeded');
      await migrateMarkdownSettings();

      const result = await migrateMarkdownSettings();

      expect(result.status).toBe('migrated');
      expect(storage.data[SelectionBulletKey]).toBe('*');
      expect(storage.data[LegacyMarkdownSettingKeys.unorderedList]).toBeUndefined();
    });

    it('keeps the migrated values when removing the legacy keys fails', async () => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';
      storage.failNextRemove = new Error('storage unavailable');

      const result = await migrateMarkdownSettings();

      expect(result.status).toBe('removal-failed');
      expect(storage.data[SelectionBulletKey]).toBe('*');
      expect(storage.data[LegacyMarkdownSettingKeys.unorderedList]).toBe('asterisk');
    });

    it('removes the legacy keys on a later retry without overwriting new values', async () => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';
      storage.failNextRemove = new Error('storage unavailable');
      await migrateMarkdownSettings();
      await SelectionSettings.setBulletListMarker('+');

      const result = await migrateMarkdownSettings();

      expect(result.status).toBe('migrated');
      expect(storage.data[LegacyMarkdownSettingKeys.unorderedList]).toBeUndefined();
      expect(storage.data[SelectionBulletKey]).toBe('+');
      expect(storage.data[MultipleLinksBulletKey]).toBe('*');
    });
  });

  describe('output preservation', () => {
    it('gives both contexts the same marker so output is unchanged right after migration', async () => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'plus';
      storage.data[LegacyMarkdownSettingKeys.codeBlock] = 'indented';
      storage.data[LegacyMarkdownSettingKeys.tabGroupIndentation] = 'tab';

      await migrateMarkdownSettings();

      const selection = await SelectionSettings.getAll();
      const multipleLinks = await MultipleLinksSettings.getAll();

      expect(selection).toEqual({ bulletListMarker: '+', codeBlockStyle: 'indented' });
      expect(multipleLinks).toEqual({ bulletListMarker: '+', tabGroupIndentation: 'tab' });
    });

    it.each([
      ['dash', '- a\n- b\n  - c\n'],
      ['asterisk', '* a\n* b\n  * c\n'],
      ['plus', '+ a\n+ b\n  + c\n'],
    ])('renders the same built-in list as legacy %s did', async (legacy, expected) => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = legacy;

      await migrateMarkdownSettings();
      const { bulletListMarker, tabGroupIndentation } = await MultipleLinksSettings.getAll();
      const markdown = new Markdown({ bulletListMarker, indentationStyle: tabGroupIndentation });

      expect(markdown.list(['a', 'b', ['c']])).toBe(expected);
    });

    it('keeps the fixed task list marker regardless of the migrated bullet marker', async () => {
      storage.data[LegacyMarkdownSettingKeys.unorderedList] = 'asterisk';

      await migrateMarkdownSettings();
      const { bulletListMarker } = await MultipleLinksSettings.getAll();
      const markdown = new Markdown({ bulletListMarker });

      expect(markdown.taskList(['a', 'b'])).toBe('- [ ] a\n- [ ] b\n');
    });

    it('renders tab-indented nesting after migrating the legacy tab choice', async () => {
      storage.data[LegacyMarkdownSettingKeys.tabGroupIndentation] = 'tab';

      await migrateMarkdownSettings();
      const { bulletListMarker, tabGroupIndentation } = await MultipleLinksSettings.getAll();
      const markdown = new Markdown({ bulletListMarker, indentationStyle: tabGroupIndentation });

      expect(markdown.list(['a', ['b']])).toBe('- a\n\t- b\n');
    });
  });
});
