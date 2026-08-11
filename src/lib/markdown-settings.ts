import type { BulletListMarker } from './markdown.js';
import { LegacyMarkdownSettingKeys, migrateMarkdownSettings } from './markdown-settings-migration.js';
import type { MultipleLinksMarkdownSettings } from './multiple-links-settings.js';
import MultipleLinksSettings, { MultipleLinksSettingKeys } from './multiple-links-settings.js';
import type { SelectionMarkdownSettings } from './selection-settings.js';
import SelectionSettings, { SelectionSettingKeys } from './selection-settings.js';
import Settings from './settings.js';

export interface MarkdownSettings {
  alwaysEscapeLinkBrackets: boolean;
  selection: SelectionMarkdownSettings;
  multipleLinks: MultipleLinksMarkdownSettings;
}

/** Every storage key whose change should re-read the settings above. */
export const markdownSettingsKeys: string[] = [
  ...Settings.keys,
  ...SelectionSettings.keys,
  ...MultipleLinksSettings.keys,
];

/**
 * Read every Markdown setting from its owning context. Does not migrate — use
 * this when reacting to a storage change, where migration has already happened.
 */
export async function readMarkdownSettings(): Promise<MarkdownSettings> {
  const [shared, selection, multipleLinks] = await Promise.all([
    Settings.getAll(),
    SelectionSettings.getAll(),
    MultipleLinksSettings.getAll(),
  ]);

  return {
    alwaysEscapeLinkBrackets: shared.alwaysEscapeLinkBrackets,
    selection,
    multipleLinks,
  };
}

/**
 * Point both contexts at one bullet-list marker, in a single write.
 *
 * Transitional: the combined settings page still presents one Unordered List
 * Character control for Copy Selection and Multiple Links. Two sequential
 * writes could half-succeed and leave the contexts permanently disagreeing
 * behind a single radio group, so they move together — exactly as atomically
 * as they did when one storage key backed the control.
 */
export async function setSharedBulletListMarker(marker: BulletListMarker): Promise<void> {
  await browser.storage.sync.set({
    [SelectionSettingKeys.bulletListMarker]: marker,
    [MultipleLinksSettingKeys.bulletListMarker]: marker,
  });
}

/**
 * Restore every Markdown setting the combined page owns, in a single removal.
 *
 * Transitional for the same reason as `setSharedBulletListMarker`: one visible
 * "Restore to Default" button must not be able to reset some contexts and not
 * others. Per-page resets replace this.
 *
 * Legacy keys go too. A migration whose cleanup failed leaves them behind, and
 * a reset that spared them would be undone by the next startup re-migrating
 * the old values over the defaults the user just asked for.
 */
export async function resetMarkdownSettings(): Promise<void> {
  await browser.storage.sync.remove([
    ...markdownSettingsKeys,
    ...Object.values(LegacyMarkdownSettingKeys),
  ]);
}

/**
 * The startup path: migrate a legacy profile, then read.
 *
 * The background script runs this on every service-worker start, so an
 * upgraded profile keeps its preferences without the user ever opening the
 * settings page. Migration failures are logged and swallowed — the legacy keys
 * survive for the next attempt, and reads fall back to the defaults meanwhile.
 */
export async function loadMarkdownSettings(): Promise<MarkdownSettings> {
  try {
    const result = await migrateMarkdownSettings();
    if (result.status === 'write-failed' || result.status === 'removal-failed') {
      console.error('failed to migrate Markdown settings', result.status, result.error);
    }
  } catch (error) {
    console.error('failed to migrate Markdown settings', error);
  }

  return await readMarkdownSettings();
}
