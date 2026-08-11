import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BuiltInStyleSettings from '../src/lib/built-in-style-settings';
import MenuVisibilitySettings from '../src/lib/menu-visibility-settings';
import CustomFormatsStorage from '../src/storage/custom-formats-storage';
import type { FakeSyncStorage } from './support/fake-sync-storage';
import { createFakeSyncStorage } from './support/fake-sync-storage';

function customFormatKey(context: string, slot: string, attribute: string): string {
  return `custom_formats.${context}.${slot}.${attribute}`;
}

describe('menu visibility settings', () => {
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
      const { builtIn, customFormats } = await MenuVisibilitySettings.getAll();

      expect(builtIn).toEqual({
        singleLink: true,
        tabLinkList: true,
        tabTaskList: true,
        tabTitleList: true,
        tabUrlList: true,
      });
      expect(customFormats).toHaveLength(10);
      expect(customFormats.every(format => format.showInMenus)).toBe(false);
    });

    it('reads persisted visibility for both kinds', async () => {
      storage.data['builtin.style.tabTitleList'] = false;
      storage.data[customFormatKey('single-link', '2', 'show_in_menus')] = true;

      const { builtIn, customFormats } = await MenuVisibilitySettings.getAll();

      expect(builtIn.tabTitleList).toBe(false);
      expect(builtIn.singleLink).toBe(true);
      const visible = customFormats.filter(format => format.showInMenus);
      expect(visible).toHaveLength(1);
      expect(visible[0]).toMatchObject({ context: 'single-link', slot: '2' });
    });

    it('exposes user-defined custom format names', async () => {
      storage.data[customFormatKey('multiple-links', '3', 'name')] = 'My Format';

      const { customFormats } = await MenuVisibilitySettings.getAll();
      const format = customFormats.find(
        entry => entry.context === 'multiple-links' && entry.slot === '3',
      );

      expect(format?.displayName).toBe('My Format');
    });

    it('lists single link formats before multiple links formats', async () => {
      const { customFormats } = await MenuVisibilitySettings.getAll();

      expect(customFormats.map(format => `${format.context}/${format.slot}`)).toEqual([
        'single-link/1',
        'single-link/2',
        'single-link/3',
        'single-link/4',
        'single-link/5',
        'multiple-links/1',
        'multiple-links/2',
        'multiple-links/3',
        'multiple-links/4',
        'multiple-links/5',
      ]);
    });
  });

  describe('setters', () => {
    it('persists built-in visibility', async () => {
      await MenuVisibilitySettings.setBuiltIn('tabUrlList', false);

      expect(storage.data['builtin.style.tabUrlList']).toBe(false);
    });

    it('persists custom format visibility without touching its name or template', async () => {
      storage.data[customFormatKey('single-link', '1', 'name')] = 'Keep Me';
      storage.data[customFormatKey('single-link', '1', 'template')] = '{{title}}';

      await MenuVisibilitySettings.setCustomFormat('single-link', '1', true);

      expect(storage.data[customFormatKey('single-link', '1', 'show_in_menus')]).toBe(true);
      expect(storage.data[customFormatKey('single-link', '1', 'name')]).toBe('Keep Me');
      expect(storage.data[customFormatKey('single-link', '1', 'template')]).toBe('{{title}}');
    });

    it('notifies menu consumers when custom format visibility changes', async () => {
      await MenuVisibilitySettings.setCustomFormat('multiple-links', '4', true);

      expect(storage.data['custom_formats.updated_at']).toEqual(expect.any(Number));
    });
  });

  describe('reset()', () => {
    it('makes every built-in visible and every custom format hidden', async () => {
      storage.data['builtin.style.singleLink'] = false;
      storage.data['builtin.style.tabLinkList'] = false;
      storage.data[customFormatKey('single-link', '1', 'show_in_menus')] = true;
      storage.data[customFormatKey('multiple-links', '5', 'show_in_menus')] = true;

      await MenuVisibilitySettings.reset();

      const { builtIn, customFormats } = await MenuVisibilitySettings.getAll();
      expect(Object.values(builtIn).every(Boolean)).toBe(true);
      expect(customFormats.every(format => format.showInMenus)).toBe(false);
    });

    it('does not modify any custom format name or template', async () => {
      storage.data[customFormatKey('single-link', '1', 'name')] = 'Alpha';
      storage.data[customFormatKey('single-link', '1', 'template')] = '[{{title}}]({{url}})';
      storage.data[customFormatKey('multiple-links', '2', 'name')] = 'Beta';
      storage.data[customFormatKey('multiple-links', '2', 'template')] = '{{#links}}{{url}}{{/links}}';

      await MenuVisibilitySettings.reset();

      expect(storage.data[customFormatKey('single-link', '1', 'name')]).toBe('Alpha');
      expect(storage.data[customFormatKey('single-link', '1', 'template')]).toBe('[{{title}}]({{url}})');
      expect(storage.data[customFormatKey('multiple-links', '2', 'name')]).toBe('Beta');
      expect(storage.data[customFormatKey('multiple-links', '2', 'template')]).toBe('{{#links}}{{url}}{{/links}}');
    });

    it('leaves settings owned by other pages alone', async () => {
      storage.data['selection.markdown.bulletListMarker'] = '+';
      storage.data['multipleLinks.markdown.tabGroupIndentation'] = 'tab';
      storage.data.linkTextAlwaysEscapeBrackets = true;

      await MenuVisibilitySettings.reset();

      expect(storage.data['selection.markdown.bulletListMarker']).toBe('+');
      expect(storage.data['multipleLinks.markdown.tabGroupIndentation']).toBe('tab');
      expect(storage.data.linkTextAlwaysEscapeBrackets).toBe(true);
    });

    it('notifies menu consumers so menus rebuild', async () => {
      await MenuVisibilitySettings.reset();

      expect(storage.data['custom_formats.updated_at']).toEqual(expect.any(Number));
    });
  });

  describe('context menu refresh', () => {
    // src/background.ts rebuilds the context menus only when a storage change
    // names a built-in style key or the custom formats' updated_at key. Every
    // write this page makes must land on one of those, or the menus go stale.
    const WatchedKeys = [...BuiltInStyleSettings.keys, CustomFormatsStorage.KeyOfLastUpdate()];

    function recordWrittenKeys(): () => string[] {
      const written: string[] = [];
      const { set, remove } = browser.storage.sync;

      vi.spyOn(browser.storage.sync, 'set').mockImplementation(async (items) => {
        written.push(...Object.keys(items as Record<string, unknown>));
        await set(items);
      });
      vi.spyOn(browser.storage.sync, 'remove').mockImplementation(async (keys) => {
        written.push(...(Array.isArray(keys) ? keys : [keys]));
        await remove(keys);
      });

      return () => written;
    }

    it('setting a built-in writes a key the refresh watches', async () => {
      const written = recordWrittenKeys();

      await MenuVisibilitySettings.setBuiltIn('tabTitleList', false);

      expect(written().some(key => WatchedKeys.includes(key))).toBe(true);
    });

    it('setting a custom format writes a key the refresh watches', async () => {
      const written = recordWrittenKeys();

      await MenuVisibilitySettings.setCustomFormat('single-link', '1', true);

      expect(written().some(key => WatchedKeys.includes(key))).toBe(true);
    });

    it('reset writes keys the refresh watches for both kinds', async () => {
      const written = recordWrittenKeys();

      await MenuVisibilitySettings.reset();

      const keys = written();
      expect(BuiltInStyleSettings.keys.every(key => keys.includes(key))).toBe(true);
      expect(keys).toContain(CustomFormatsStorage.KeyOfLastUpdate());
    });
  });
});
