import { migrateMarkdownSettings } from './markdown-settings-migration.js';
import type { MultipleLinksMarkdownSettings } from './multiple-links-settings.js';
import MultipleLinksSettings from './multiple-links-settings.js';
import type { SelectionMarkdownSettings } from './selection-settings.js';
import SelectionSettings from './selection-settings.js';
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
