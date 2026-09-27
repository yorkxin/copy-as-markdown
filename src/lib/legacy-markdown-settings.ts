// Two legacy keys contain trailing spaces; lookups use their exact stored names.
// This module has no imports, avoiding a cycle between migration and context settings.
export const LegacyMarkdownSettingKeys = {
  unorderedList: 'styleOfUnorderedList ',
  codeBlock: 'styleOfCodeBlock',
  tabGroupIndentation: 'style.tabgroup.indentation ',
} as const;
