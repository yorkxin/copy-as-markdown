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
        emDelimiter: '_',
        strongDelimiter: '**',
        headingStyle: 'atx',
        fence: '```',
      });
    });

    it('reads persisted values', async () => {
      storage.data[SelectionSettingKeys.bulletListMarker] = '+';
      storage.data[SelectionSettingKeys.codeBlockStyle] = 'indented';

      expect(await SelectionSettings.getAll()).toEqual({
        bulletListMarker: '+',
        codeBlockStyle: 'indented',
        emDelimiter: '_',
        strongDelimiter: '**',
        headingStyle: 'atx',
        fence: '```',
      });
    });

    it('falls back per setting when a persisted value is invalid', async () => {
      storage.data[SelectionSettingKeys.bulletListMarker] = 'circle';
      storage.data[SelectionSettingKeys.codeBlockStyle] = 'indented';

      expect(await SelectionSettings.getAll()).toEqual({
        bulletListMarker: '-',
        codeBlockStyle: 'indented',
        emDelimiter: '_',
        strongDelimiter: '**',
        headingStyle: 'atx',
        fence: '```',
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

  it.each(['_', '*'] as const)('persists emphasis %s', async (value) => {
    await SelectionSettings.setEmDelimiter(value);
    expect(storage.data[SelectionSettingKeys.emDelimiter]).toBe(value);
    expect((await SelectionSettings.getAll()).emDelimiter).toBe(value);
  });

  it.each(['**', '__'] as const)('persists strong emphasis %s', async (value) => {
    await SelectionSettings.setStrongDelimiter(value);
    expect(storage.data[SelectionSettingKeys.strongDelimiter]).toBe(value);
    expect((await SelectionSettings.getAll()).strongDelimiter).toBe(value);
  });

  it.each([null, 42, {}, '', '**', '__', 'future'])('falls back only for invalid emphasis %j without rewriting it', async (value) => {
    storage.data[SelectionSettingKeys.emDelimiter] = value;
    storage.data[SelectionSettingKeys.strongDelimiter] = '__';
    const before = { ...storage.data };
    expect(await SelectionSettings.getAll()).toMatchObject({ emDelimiter: '_', strongDelimiter: '__' });
    expect(storage.data).toEqual(before);
  });

  it.each([null, 42, {}, '', '*', '_', 'future'])('falls back only for invalid strong emphasis %j without rewriting it', async (value) => {
    storage.data[SelectionSettingKeys.emDelimiter] = '*';
    storage.data[SelectionSettingKeys.strongDelimiter] = value;
    const before = { ...storage.data };
    expect(await SelectionSettings.getAll()).toMatchObject({ emDelimiter: '*', strongDelimiter: '**' });
    expect(storage.data).toEqual(before);
  });

  it.each(['atx', 'setext'] as const)('persists heading style %s', async (value) => {
    await SelectionSettings.setHeadingStyle(value);
    expect(storage.data[SelectionSettingKeys.headingStyle]).toBe(value);
    expect((await SelectionSettings.getAll()).headingStyle).toBe(value);
  });

  it.each(['```', '~~~'] as const)('persists fence %s', async (value) => {
    await SelectionSettings.setFence(value);
    expect(storage.data[SelectionSettingKeys.fence]).toBe(value);
    expect((await SelectionSettings.getAll()).fence).toBe(value);
  });

  it('keeps the fence preference while code blocks are indented', async () => {
    await SelectionSettings.setFence('~~~');
    await SelectionSettings.setCodeBlockStyle('indented');

    expect(await SelectionSettings.getAll()).toMatchObject({ codeBlockStyle: 'indented', fence: '~~~' });
    expect(storage.data[SelectionSettingKeys.fence]).toBe('~~~');
  });

  it.each([null, 42, {}, '', 'ATX', 'future'])('falls back only for invalid heading style %j without rewriting it', async (value) => {
    storage.data[SelectionSettingKeys.headingStyle] = value;
    storage.data[SelectionSettingKeys.fence] = '~~~';
    const before = { ...storage.data };
    expect(await SelectionSettings.getAll()).toMatchObject({ headingStyle: 'atx', fence: '~~~' });
    expect(storage.data).toEqual(before);
  });

  it.each([null, 42, {}, '', '`', '~~~~', 'future'])('falls back only for invalid fence %j without rewriting it', async (value) => {
    storage.data[SelectionSettingKeys.headingStyle] = 'setext';
    storage.data[SelectionSettingKeys.fence] = value;
    const before = { ...storage.data };
    expect(await SelectionSettings.getAll()).toMatchObject({ headingStyle: 'setext', fence: '```' });
    expect(storage.data).toEqual(before);
  });

  it('owns the documented storage keys', () => {
    expect(SelectionSettings.keys).toEqual([
      'selection.markdown.bulletListMarker',
      'selection.markdown.codeBlockStyle',
      'selection.markdown.emDelimiter',
      'selection.markdown.strongDelimiter',
      'selection.markdown.headingStyle',
      'selection.markdown.fence',
    ]);
  });
});
