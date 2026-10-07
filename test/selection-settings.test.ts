import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SelectionSettings, { SelectionSettingKeys } from '../src/lib/selection-settings';
import type { FakeSyncStorage } from './support/fake-sync-storage';
import { createFakeSyncStorage } from './support/fake-sync-storage';

const defaults = {
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**',
  headingStyle: 'atx',
  fence: '```',
  linkStyle: 'inlined',
  linkReferenceStyle: 'full',
};

describe('selection settings', () => {
  let storage: FakeSyncStorage;

  beforeEach(() => {
    storage = createFakeSyncStorage();
    storage.install();
  });

  afterEach(() => {
    storage.uninstall();
  });

  it('uses clean-install defaults without writing storage', async () => {
    expect(await SelectionSettings.getAll()).toEqual(defaults);
    expect(storage.data).toEqual({});
  });

  it.each([
    ['bulletListMarker', ['-', '*', '+'], 'circle'],
    ['codeBlockStyle', ['fenced', 'indented'], 'html'],
    ['emDelimiter', ['_', '*'], '**'],
    ['strongDelimiter', ['**', '__'], '*'],
    ['headingStyle', ['atx', 'setext'], 'ATX'],
    ['fence', ['```', '~~~'], '~~~~'],
    ['linkStyle', ['inlined', 'referenced'], 'inline'],
    ['linkReferenceStyle', ['full', 'collapsed', 'shortcut'], 'FULL'],
  ] as const)('accepts all supported %s values and rejects an unsupported value', async (field, values, invalid) => {
    for (const value of values) {
      storage.data[SelectionSettingKeys[field]] = value;
      expect((await SelectionSettings.getAll())[field]).toBe(value);
    }
    storage.data[SelectionSettingKeys[field]] = invalid;
    expect((await SelectionSettings.getAll())[field]).toBe(defaults[field]);
  });

  it('falls back independently for malformed fields without rewriting storage', async () => {
    storage.data = {
      [SelectionSettingKeys.bulletListMarker]: null,
      [SelectionSettingKeys.codeBlockStyle]: 'indented',
      [SelectionSettingKeys.emDelimiter]: 42,
      [SelectionSettingKeys.strongDelimiter]: '__',
      [SelectionSettingKeys.headingStyle]: {},
      [SelectionSettingKeys.fence]: '~~~',
      [SelectionSettingKeys.linkStyle]: [],
      [SelectionSettingKeys.linkReferenceStyle]: 'collapsed',
    };
    const before = { ...storage.data };
    const set = vi.spyOn(browser.storage.sync, 'set');
    expect(await SelectionSettings.getAll()).toEqual({
      ...defaults,
      codeBlockStyle: 'indented',
      strongDelimiter: '__',
      fence: '~~~',
      linkReferenceStyle: 'collapsed',
    });
    expect(storage.data).toEqual(before);
    expect(set).not.toHaveBeenCalled();
  });

  it('round-trips independent preferences through their setters', async () => {
    await SelectionSettings.setBulletListMarker('+');
    await SelectionSettings.setCodeBlockStyle('indented');
    await SelectionSettings.setEmDelimiter('*');
    await SelectionSettings.setStrongDelimiter('__');
    await SelectionSettings.setHeadingStyle('setext');
    await SelectionSettings.setFence('~~~');
    await SelectionSettings.setLinkStyle('referenced');
    await SelectionSettings.setLinkReferenceStyle('collapsed');
    expect(await SelectionSettings.getAll()).toEqual({
      bulletListMarker: '+',
      codeBlockStyle: 'indented',
      emDelimiter: '*',
      strongDelimiter: '__',
      headingStyle: 'setext',
      fence: '~~~',
      linkStyle: 'referenced',
      linkReferenceStyle: 'collapsed',
    });
  });

  it('retains the reference preference when switching to inline and back', async () => {
    await SelectionSettings.setReferencedLinkStyle('shortcut');
    await SelectionSettings.setLinkStyle('inlined');
    expect(await SelectionSettings.getAll()).toMatchObject({ linkStyle: 'inlined', linkReferenceStyle: 'shortcut' });
    await SelectionSettings.setLinkStyle('referenced');
    expect(await SelectionSettings.getAll()).toMatchObject({ linkStyle: 'referenced', linkReferenceStyle: 'shortcut' });
  });

  it.each(['```', '~~~'] as const)('writes fenced style and fence %s together', async (fence) => {
    await SelectionSettings.setCodeBlockStyle('indented');
    const set = vi.spyOn(browser.storage.sync, 'set');

    await SelectionSettings.setFencedCodeBlockStyle(fence);

    expect(set).toHaveBeenCalledExactlyOnceWith({
      [SelectionSettingKeys.codeBlockStyle]: 'fenced',
      [SelectionSettingKeys.fence]: fence,
    });
    expect(await SelectionSettings.getAll()).toMatchObject({ codeBlockStyle: 'fenced', fence });
  });

  it('keeps the fence preference while code blocks are indented', async () => {
    await SelectionSettings.setFence('~~~');
    await SelectionSettings.setCodeBlockStyle('indented');

    expect(await SelectionSettings.getAll()).toMatchObject({ codeBlockStyle: 'indented', fence: '~~~' });
    expect(storage.data[SelectionSettingKeys.fence]).toBe('~~~');
  });

  it.each(['full', 'collapsed', 'shortcut'] as const)('writes referenced %s output in a single storage update', async (value) => {
    const set = vi.spyOn(browser.storage.sync, 'set');
    await SelectionSettings.setReferencedLinkStyle(value);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({
      [SelectionSettingKeys.linkStyle]: 'referenced',
      [SelectionSettingKeys.linkReferenceStyle]: value,
    });
    expect(await SelectionSettings.getAll()).toMatchObject({ linkStyle: 'referenced', linkReferenceStyle: value });
  });

  it.each([
    ['fenced code', () => SelectionSettings.setFencedCodeBlockStyle('~~~')],
    ['referenced link', () => SelectionSettings.setReferencedLinkStyle('collapsed')],
  ] as const)('retains both preferences when an atomic %s write fails', async (_name, save) => {
    await SelectionSettings.setCodeBlockStyle('indented');
    await SelectionSettings.setFence('```');
    await SelectionSettings.setLinkStyle('inlined');
    await SelectionSettings.setLinkReferenceStyle('shortcut');
    const before = await SelectionSettings.getAll();
    storage.failNextSet = new Error('quota exceeded');
    await expect(save()).rejects.toThrow('quota exceeded');
    expect(await SelectionSettings.getAll()).toEqual(before);
  });
});
