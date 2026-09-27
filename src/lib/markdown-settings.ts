import { LegacyMarkdownSettingKeys } from './legacy-markdown-settings.js';
import { isBulletListMarker } from './markdown.js';
import { migrateMarkdownSettings } from './markdown-settings-migration.js';
import type { MultipleLinksMarkdownSettings } from './multiple-links-settings.js';
import MultipleLinksSettings, { MultipleLinksSettingDefaults, MultipleLinksSettingKeys } from './multiple-links-settings.js';
import type { SelectionMarkdownSettings } from './selection-settings.js';
import SelectionSettings, { SelectionSettingDefaults, SelectionSettingKeys } from './selection-settings.js';
import Settings from './settings.js';

export interface MarkdownSettings {
  alwaysEscapeLinkBrackets: boolean;
  selection: SelectionMarkdownSettings;
  multipleLinks: MultipleLinksMarkdownSettings;
}

/** Union of settings keys watched by the background process. */
export const markdownSettingsKeys: string[] = [
  ...Settings.keys,
  ...SelectionSettings.keys,
  ...MultipleLinksSettings.keys,
];

/** Reads current settings without running migration. */
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

/** Migration failures are non-fatal because the legacy keys remain for retry. */
export async function ensureMarkdownSettingsMigrated(): Promise<void> {
  try {
    const result = await migrateMarkdownSettings();
    if (result.status === 'write-failed' || result.status === 'removal-failed') {
      console.error('failed to migrate Markdown settings', result.status, result.error);
    }
  } catch (error) {
    console.error('failed to migrate Markdown settings', error);
  }
}

interface ContextResetPlan {
  keys: string[];
  defaults: Record<string, unknown>;
  exclusiveLegacyKeys: string[];
  siblingBulletListMarkerKey: string;
}

function isPresent(stored: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(stored, key);
}

/**
 * Reset is centralized because retiring the shared marker requires both contexts'
 * state; neither context owns that cross-context decision.
 * The legacy marker remains until that sibling target is materialized.
 * Defaults are written instead of removing keys, preventing a later migration
 * from undoing the reset while the sibling waits to migrate.
 */
async function resetContext(plan: ContextResetPlan): Promise<void> {
  await ensureMarkdownSettingsMigrated();

  const stored = await browser.storage.sync.get([
    LegacyMarkdownSettingKeys.unorderedList,
    plan.siblingBulletListMarkerKey,
  ]);

  const sharedLegacyMarkerRemains = isPresent(stored, LegacyMarkdownSettingKeys.unorderedList);
  // Migration treats unreadable targets as unmaterialized, so reset preserves
  // the shared marker for the same recoverability case.
  const siblingIsMaterialized = isBulletListMarker(stored[plan.siblingBulletListMarkerKey]);

  if (sharedLegacyMarkerRemains && !siblingIsMaterialized) {
    await browser.storage.sync.set(plan.defaults);
    if (plan.exclusiveLegacyKeys.length > 0) {
      await browser.storage.sync.remove(plan.exclusiveLegacyKeys);
    }
    return;
  }

  await browser.storage.sync.remove([
    ...plan.keys,
    ...plan.exclusiveLegacyKeys,
    ...(sharedLegacyMarkerRemains ? [LegacyMarkdownSettingKeys.unorderedList] : []),
  ]);
}

/** Resets Copy Selection settings without changing other contexts. */
export async function resetSelectionSettings(): Promise<void> {
  await resetContext({
    keys: SelectionSettings.keys,
    defaults: {
      [SelectionSettingKeys.bulletListMarker]: SelectionSettingDefaults.bulletListMarker,
      [SelectionSettingKeys.codeBlockStyle]: SelectionSettingDefaults.codeBlockStyle,
    },
    exclusiveLegacyKeys: [LegacyMarkdownSettingKeys.codeBlock],
    siblingBulletListMarkerKey: MultipleLinksSettingKeys.bulletListMarker,
  });
}

/** Resets Multiple Links settings without changing other contexts. */
export async function resetMultipleLinksSettings(): Promise<void> {
  await resetContext({
    keys: MultipleLinksSettings.keys,
    defaults: {
      [MultipleLinksSettingKeys.bulletListMarker]: MultipleLinksSettingDefaults.bulletListMarker,
      [MultipleLinksSettingKeys.tabGroupIndentation]: MultipleLinksSettingDefaults.tabGroupIndentation,
    },
    exclusiveLegacyKeys: [LegacyMarkdownSettingKeys.tabGroupIndentation],
    siblingBulletListMarkerKey: SelectionSettingKeys.bulletListMarker,
  });
}

/**
 * Migrates legacy settings before reading; failures retain legacy keys and
 * reads fall back to defaults.
 */
export async function loadMarkdownSettings(): Promise<MarkdownSettings> {
  await ensureMarkdownSettingsMigrated();
  return await readMarkdownSettings();
}
