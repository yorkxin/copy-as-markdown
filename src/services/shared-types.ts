export interface MarkdownFormatter {
  escapeLinkText: (text: string) => string;
  linkTo: (title: string, url: string) => string;
  list: (items: any[]) => string;
  taskList: (items: any[]) => string;
}

export interface CustomFormat {
  render: (input: any) => string;
}

export interface CustomFormatsProvider {
  get: (context: 'single-link' | 'multiple-links', slot: string) => Promise<CustomFormat>;
  list?: (context: 'single-link' | 'multiple-links') => Promise<CustomFormat[]>;
}

export interface ScriptingAPI {
  executeScript: <T extends any[]>(options: {
    target: { tabId: number; allFrames?: boolean; frameIds?: number[] };
    func?: (...args: T) => any;
    files?: string[];
    args?: T;
  }) => Promise<Array<{ result?: any }>>;
}

export interface TabsAPI {
  query: (queryInfo: browser.tabs._QueryQueryInfo) => Promise<browser.tabs.Tab[]>;
  get?: (tabId: number) => Promise<browser.tabs.Tab>;
}

export interface PermissionsAPI {
  contains: (permissions: { permissions: string[] }) => Promise<boolean>;
}

export interface ContextMenusAPI {
  create: (createProperties: browser.menus._CreateCreateProperties) => void;
  remove: (id: string) => Promise<void>;
  removeAll: () => Promise<void>;
}

export interface ClipboardAPI {
  writeText: (text: string) => Promise<void>;
}

export interface AlarmsAPI {
  create: (name: string, alarmInfo: { when: number } | { periodInMinutes: number }) => void;
}

export interface WindowsAPI {
  create: (createData: browser.windows._CreateCreateData) => Promise<browser.windows.Window | undefined>;
}

export interface RuntimeAPI {
  getURL: (path: string) => string;
}

export interface TabGroupsAPI {
  query: (queryInfo: { windowId: number }) => Promise<chrome.tabGroups.TabGroup[]>;
}
