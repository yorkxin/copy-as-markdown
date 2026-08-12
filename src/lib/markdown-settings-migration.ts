import { LegacyMarkdownSettingKeys } from './legacy-markdown-settings.js';
import type { BulletListMarker } from './markdown.js';
import { isBulletListMarker, isTabGroupIndentationStyle } from './markdown.js';
import MultipleLinksSettings, { MultipleLinksSettingDefaults, MultipleLinksSettingKeys } from './multiple-links-settings.js';
import type { CodeBlockStyle } from './selection-settings.js';
import SelectionSettings, { isCodeBlockStyle, SelectionSettingDefaults, SelectionSettingKeys } from './selection-settings.js';

export { LegacyMarkdownSettingKeys };

const LegacyUnorderedListMarkers: Record<string, BulletListMarker> = {
  dash: '-',
  asterisk: '*',
  plus: '+',
};

export type MarkdownSettingsMigrationResult
  = | { status: 'skipped' }
    | { status: 'migrated' }
    | { status: 'legacy-retained' }
    | { status: 'write-failed'; error: unknown }
    | { status: 'removal-failed'; error: unknown };

const TargetValidators: Record<string, (value: unknown) => boolean> = {
  [SelectionSettingKeys.bulletListMarker]: isBulletListMarker,
  [SelectionSettingKeys.codeBlockStyle]: isCodeBlockStyle,
  [MultipleLinksSettingKeys.bulletListMarker]: isBulletListMarker,
  [MultipleLinksSettingKeys.tabGroupIndentation]: isTabGroupIndentationStyle,
};

function legacyBulletListMarker(value: unknown): BulletListMarker | null {
  return (typeof value === 'string' && LegacyUnorderedListMarkers[value]) || null;
}

function legacyCodeBlockStyle(value: unknown): CodeBlockStyle | null {
  return value === 'fenced' || value === 'indented' ? value : null;
}

/**
 * Moves the Markdown preferences that Copy Selection and Multiple Links used to
 * share into their context-owned keys.
 *
 * The migration is idempotent and safe to resume:
 *
 * - A target key that is already present is left untouched, valid or not. A
 *   user's post-migration choice therefore always wins, and a value written by
 *   a newer version is never clobbered.
 * - A missing target is populated from the legacy value, or from the context
 *   default when the legacy value is absent or unrecognized.
 * - Legacy keys are removed only once every target holds a value this version
 *   can read. An unreadable target means the preference is not preserved
 *   anywhere yet, so the legacy keys stay put rather than being destroyed —
 *   whoever wrote that value keeps its chance to migrate it.
 * - A failed write leaves the legacy keys in place for the next attempt; a
 *   failed removal can be retried without overwriting anything.
 */
export async function migrateMarkdownSettings(): Promise<MarkdownSettingsMigrationResult> {
  const legacyKeys = Object.values(LegacyMarkdownSettingKeys) as string[];
  const stored = await browser.storage.sync.get([
    ...legacyKeys,
    ...SelectionSettings.keys,
    ...MultipleLinksSettings.keys,
  ]);

  const presentLegacyKeys = legacyKeys.filter(key => Object.prototype.hasOwnProperty.call(stored, key));
  if (presentLegacyKeys.length === 0) {
    // Nothing to preserve: a clean install, or migration already completed.
    return { status: 'skipped' };
  }

  const legacyMarker = legacyBulletListMarker(stored[LegacyMarkdownSettingKeys.unorderedList]);
  const legacyCodeBlock = legacyCodeBlockStyle(stored[LegacyMarkdownSettingKeys.codeBlock]);
  const legacyIndentation = stored[LegacyMarkdownSettingKeys.tabGroupIndentation];

  const targets = {
    [SelectionSettingKeys.bulletListMarker]:
      legacyMarker ?? SelectionSettingDefaults.bulletListMarker,
    [SelectionSettingKeys.codeBlockStyle]:
      legacyCodeBlock ?? SelectionSettingDefaults.codeBlockStyle,
    [MultipleLinksSettingKeys.bulletListMarker]:
      legacyMarker ?? MultipleLinksSettingDefaults.bulletListMarker,
    [MultipleLinksSettingKeys.tabGroupIndentation]:
      isTabGroupIndentationStyle(legacyIndentation)
        ? legacyIndentation
        : MultipleLinksSettingDefaults.tabGroupIndentation,
  };

  const updates = Object.fromEntries(
    Object.entries(targets).filter(([key]) => !Object.prototype.hasOwnProperty.call(stored, key)),
  );

  if (Object.keys(updates).length > 0) {
    try {
      await browser.storage.sync.set(updates);
    } catch (error) {
      return { status: 'write-failed', error };
    }
  }

  // Everything just written is valid by construction; only pre-existing target
  // values can still be unreadable, and those must not cost the user a legacy
  // key that still holds their real preference.
  const hasUnreadableTarget = Object.keys(targets)
    .filter(key => !Object.prototype.hasOwnProperty.call(updates, key))
    .some(key => !TargetValidators[key]!(stored[key]));

  if (hasUnreadableTarget) {
    return { status: 'legacy-retained' };
  }

  try {
    await browser.storage.sync.remove(presentLegacyKeys);
  } catch (error) {
    return { status: 'removal-failed', error };
  }

  return { status: 'migrated' };
}
