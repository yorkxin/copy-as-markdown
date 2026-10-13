import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import CleanupSettings, { CleanupSettingKeys } from '../src/lib/cleanup-settings';
import type { FakeSyncStorage } from './support/fake-sync-storage';
import { createFakeSyncStorage } from './support/fake-sync-storage';

describe('cleanup settings', () => {
  let storage: FakeSyncStorage;

  beforeEach(() => {
    storage = createFakeSyncStorage();
    storage.install();
  });

  afterEach(() => {
    storage.uninstall();
  });

  it('defaults every action to off without writing storage', async () => {
    expect(await CleanupSettings.getAll())
      .toEqual({ removeImages: false, removeLinks: false, cleanChatExport: false });
    expect(storage.data).toEqual({});
  });

  it('stores each action independently', async () => {
    await CleanupSettings.set('removeLinks', true);
    expect(storage.data).toEqual({ [CleanupSettingKeys.removeLinks]: true });
    expect(await CleanupSettings.getAll())
      .toEqual({ removeImages: false, removeLinks: true, cleanChatExport: false });
  });

  it('ignores non-boolean stored values', async () => {
    storage.data[CleanupSettingKeys.removeImages] = 'yes';
    expect((await CleanupSettings.getAll()).removeImages).toBe(false);
  });

  it('reset removes the keys', async () => {
    await CleanupSettings.set('removeImages', true);
    await CleanupSettings.reset();
    expect(storage.data).toEqual({});
  });
});
