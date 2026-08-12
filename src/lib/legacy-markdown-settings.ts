/**
 * Storage keys written by versions that predate context-owned settings.
 *
 * [sic.] Two of them have a trailing space, introduced by a typo when they were
 * added. They are matched verbatim here; migration is what finally retires them.
 *
 * This module deliberately depends on nothing: both the migration and the
 * context settings modules name these keys, and the migration already imports
 * the context modules.
 */
export const LegacyMarkdownSettingKeys = {
  unorderedList: 'styleOfUnorderedList ',
  codeBlock: 'styleOfCodeBlock',
  tabGroupIndentation: 'style.tabgroup.indentation ',
} as const;
