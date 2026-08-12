import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TabGroupIndentationStyle } from '../src/lib/markdown';
import MultipleLinksSettings, { MultipleLinksSettingKeys } from '../src/lib/multiple-links-settings';
import type { FakeSyncStorage } from './support/fake-sync-storage';
import { createFakeSyncStorage } from './support/fake-sync-storage';

describe('multiple links settings', () => {
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
      expect(await MultipleLinksSettings.getAll()).toEqual({
        bulletListMarker: '-',
        tabGroupIndentation: TabGroupIndentationStyle.Spaces,
      });
    });

    it('reads persisted values', async () => {
      storage.data[MultipleLinksSettingKeys.bulletListMarker] = '*';
      storage.data[MultipleLinksSettingKeys.tabGroupIndentation] = 'tab';

      expect(await MultipleLinksSettings.getAll()).toEqual({
        bulletListMarker: '*',
        tabGroupIndentation: TabGroupIndentationStyle.Tab,
      });
    });

    it('falls back per setting when a persisted value is invalid', async () => {
      storage.data[MultipleLinksSettingKeys.bulletListMarker] = '*';
      storage.data[MultipleLinksSettingKeys.tabGroupIndentation] = 'em-space';

      expect(await MultipleLinksSettings.getAll()).toEqual({
        bulletListMarker: '*',
        tabGroupIndentation: TabGroupIndentationStyle.Spaces,
      });
    });

    it('does not rewrite an invalid persisted value', async () => {
      storage.data[MultipleLinksSettingKeys.bulletListMarker] = 'dash';

      await MultipleLinksSettings.getAll();

      expect(storage.data[MultipleLinksSettingKeys.bulletListMarker]).toBe('dash');
    });
  });

  describe('setters', () => {
    it('persists the bullet list marker verbatim', async () => {
      await MultipleLinksSettings.setBulletListMarker('+');
      expect(storage.data[MultipleLinksSettingKeys.bulletListMarker]).toBe('+');
    });

    it('persists the tab group indentation', async () => {
      await MultipleLinksSettings.setTabGroupIndentation(TabGroupIndentationStyle.Tab);
      expect(storage.data[MultipleLinksSettingKeys.tabGroupIndentation]).toBe('tab');
    });
  });

  it('owns the documented storage keys', () => {
    expect(MultipleLinksSettings.keys).toEqual([
      'multipleLinks.markdown.bulletListMarker',
      'multipleLinks.markdown.tabGroupIndentation',
    ]);
  });
});
