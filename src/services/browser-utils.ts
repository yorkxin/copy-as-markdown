import type { TabsAPI } from './shared-types.js';

/** Uses the provided tab or the current window's sole active tab; throws otherwise. */
export async function mustGetCurrentTab(
  tabsAPI: TabsAPI,
  providedTab?: browser.tabs.Tab,
): Promise<browser.tabs.Tab> {
  if (providedTab) {
    return providedTab;
  }

  const tabs = await tabsAPI.query({
    currentWindow: true,
    active: true,
  });

  if (tabs.length !== 1) {
    throw new Error('failed to get current tab');
  }

  return tabs[0]!;
}

export function requireWindowId(tab: browser.tabs.Tab): number {
  if (tab.windowId === undefined) {
    throw new Error('tab has no windowId');
  }
  return tab.windowId;
}

/** Splits IDs such as `current-tab-custom-format-1` into a permitted context and slot. */
export function parseCustomFormatCommand<T extends string>(
  command: string,
  contexts: readonly T[],
): { context: T; slot: string } {
  const contextPattern = contexts.join('|');
  const regex = new RegExp(`(${contextPattern})-custom-format-(\\d)`);
  const match = regex.exec(command);

  if (match === null) {
    throw new TypeError(`unknown custom format command: ${command}`);
  }

  const context = match[1] as T;
  const slot = match[2]!;
  return { context, slot };
}
