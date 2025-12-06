/**
 * Shared command/menu identifiers to avoid stringly-typed branching.
 */

// Keyboard command IDs registered in manifest
export const KeyboardCommandIds = {
  SelectionAsMarkdown: 'selection-as-markdown',
  CurrentTabLink: 'current-tab-link',
  AllTabsLinkAsList: 'all-tabs-link-as-list',
  AllTabsLinkAsTaskList: 'all-tabs-link-as-task-list',
  AllTabsTitleAsList: 'all-tabs-title-as-list',
  AllTabsUrlAsList: 'all-tabs-url-as-list',
  HighlightedTabsLinkAsList: 'highlighted-tabs-link-as-list',
  HighlightedTabsLinkAsTaskList: 'highlighted-tabs-link-as-task-list',
  HighlightedTabsTitleAsList: 'highlighted-tabs-title-as-list',
  HighlightedTabsUrlAsList: 'highlighted-tabs-url-as-list',
} as const;

export type BuiltInKeyboardCommandId = typeof KeyboardCommandIds[keyof typeof KeyboardCommandIds];

export type CustomFormatCommandContext = 'current-tab' | 'all-tabs' | 'highlighted-tabs';
export type CustomFormatCommandId = `${CustomFormatCommandContext}-custom-format-${number}`;

export type KeyboardCommandId = BuiltInKeyboardCommandId | CustomFormatCommandId;

// Context menu IDs
export const ContextMenuIds = {
  CurrentTab: 'current-tab',
  Link: 'link',
  Image: 'image',
  SelectionAsMarkdown: 'selection-as-markdown',
  AllTabsLinkAsList: 'all-tabs-link-as-list',
  AllTabsLinkAsTaskList: 'all-tabs-link-as-task-list',
  AllTabsTitleAsList: 'all-tabs-title-as-list',
  AllTabsUrlAsList: 'all-tabs-url-as-list',
  HighlightedTabsLinkAsList: 'highlighted-tabs-link-as-list',
  HighlightedTabsLinkAsTaskList: 'highlighted-tabs-link-as-task-list',
  HighlightedTabsTitleAsList: 'highlighted-tabs-title-as-list',
  HighlightedTabsUrlAsList: 'highlighted-tabs-url-as-list',
  BookmarkLink: 'bookmark-link',
} as const;

export type BuiltInContextMenuId = typeof ContextMenuIds[keyof typeof ContextMenuIds];

export type CustomFormatMenuContext = CustomFormatCommandContext | 'link';
export type CustomFormatMenuId = `${CustomFormatMenuContext}-custom-format-${number}`;

export type ContextMenuId = BuiltInContextMenuId | CustomFormatMenuId;
