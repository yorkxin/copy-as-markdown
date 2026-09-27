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
 * Migration is idempotent and resume-safe:
 * - Existing targets are never overwritten, including unreadable newer values.
 * - Missing targets use a readable legacy value or their context default.
 * - Legacy keys remain until every target is readable.
 * - Failed writes preserve legacy input; failed removals retry without rewriting targets.
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

  // A pre-existing unreadable target may belong to a newer version.
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
