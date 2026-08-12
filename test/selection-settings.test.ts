import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import SelectionSettings, { SelectionSettingKeys } from '../src/lib/selection-settings';
import type { FakeSyncStorage } from './support/fake-sync-storage';
import { createFakeSyncStorage } from './support/fake-sync-storage';

describe('selection settings', () => {
  let storage: FakeSyncStorage;

  beforeEach(() => {
    storage = createFakeSyncStorage();
    storage.install();
  });

  afterEach(() => {
    storage.uninstall();
  });

  describe('getAll()', () => {
    it('falls back to the clean-install defaults when nothing is stored', async () => {
      expect(await SelectionSettings.getAll()).toEqual({
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
      });
    });

    it('reads persisted values', async () => {
      storage.data[SelectionSettingKeys.bulletListMarker] = '+';
      storage.data[SelectionSettingKeys.codeBlockStyle] = 'indented';

      expect(await SelectionSettings.getAll()).toEqual({
        bulletListMarker: '+',
        codeBlockStyle: 'indented',
      });
    });

    it('falls back per setting when a persisted value is invalid', async () => {
      storage.data[SelectionSettingKeys.bulletListMarker] = 'circle';
      storage.data[SelectionSettingKeys.codeBlockStyle] = 'indented';

      expect(await SelectionSettings.getAll()).toEqual({
        bulletListMarker: '-',
        codeBlockStyle: 'indented',
      });
    });

    it('does not rewrite an invalid persisted value', async () => {
      storage.data[SelectionSettingKeys.codeBlockStyle] = 'from-the-future';

      await SelectionSettings.getAll();

      expect(storage.data[SelectionSettingKeys.codeBlockStyle]).toBe('from-the-future');
    });
  });

  describe('setters', () => {
    it('persists the bullet list marker verbatim', async () => {
      await SelectionSettings.setBulletListMarker('*');
      expect(storage.data[SelectionSettingKeys.bulletListMarker]).toBe('*');
    });

    it('persists the code block style', async () => {
      await SelectionSettings.setCodeBlockStyle('indented');
      expect(storage.data[SelectionSettingKeys.codeBlockStyle]).toBe('indented');
    });
  });

  it('owns the documented storage keys', () => {
    expect(SelectionSettings.keys).toEqual([
      'selection.markdown.bulletListMarker',
      'selection.markdown.codeBlockStyle',
    ]);
  });
});
