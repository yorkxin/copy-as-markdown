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

/**
 * Every storage key whose change should re-read the settings above.
 *
 * Each options page watches only the keys its own context owns; this is the
 * union the background script watches, since it applies all of them.
 */
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
 * Bring a legacy profile into context-owned storage, logging any failure.
 *
 * Every options page that shows a migrated preference calls this before its
 * first read, so whichever page the user opens first shows their real choice
 * rather than a default. Migration is idempotent, so racing the background
 * copy — or another options page — is safe. Failures are swallowed: the legacy
 * keys survive for the next attempt and reads fall back to defaults meanwhile.
 */
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
  /** Every key the context owns. */
  keys: string[];
  /** Those same keys mapped to their defaults. */
  defaults: Record<string, unknown>;
  /** Legacy keys only this context migrates from. */
  exclusiveLegacyKeys: string[];
  /** The other context's bullet-marker key — the other half of the shared legacy source. */
  siblingBulletListMarkerKey: string;
}

function isPresent(stored: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(stored, key);
}

/**
 * Restore one context to its defaults, and retire the legacy keys it migrates
 * from — but never at the other context's expense.
 *
 * Legacy retirement lives here rather than in the context modules because the
 * unordered-list key is the migration source for *both* contexts. A context
 * cannot see whether its sibling has materialized a copy yet, so it must not be
 * the one to decide that key is spent.
 *
 * The reset first runs the (idempotent) migration, which normally materializes
 * both contexts and clears the legacy keys itself, leaving nothing to decide.
 * When the shared legacy marker outlives that — a failed migration write, or a
 * sibling value this version cannot read — it is still the sibling's only copy,
 * so it stays, and this context persists its defaults instead of removing its
 * keys. A present value always beats a legacy one during migration, so the
 * reset is just as final while the sibling keeps its chance to migrate.
 */
async function resetContext(plan: ContextResetPlan): Promise<void> {
  await ensureMarkdownSettingsMigrated();

  const stored = await browser.storage.sync.get([
    LegacyMarkdownSettingKeys.unorderedList,
    plan.siblingBulletListMarkerKey,
  ]);

  const sharedLegacyMarkerRemains = isPresent(stored, LegacyMarkdownSettingKeys.unorderedList);
  // Present but unreadable counts as not materialized: migration keeps the
  // legacy key alive for exactly that case, and so must this.
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

/** The Copy Selection page's reset. Leaves every other context untouched. */
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

/** The Multiple Links page's reset. Leaves every other context untouched. */
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
 * The startup path: migrate a legacy profile, then read.
 *
 * The background script runs this on every service-worker start, so an
 * upgraded profile keeps its preferences without the user ever opening the
 * settings page. Migration failures are logged and swallowed — the legacy keys
 * survive for the next attempt, and reads fall back to the defaults meanwhile.
 */
export async function loadMarkdownSettings(): Promise<MarkdownSettings> {
  await ensureMarkdownSettingsMigrated();
  return await readMarkdownSettings();
}
