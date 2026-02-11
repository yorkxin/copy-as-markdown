export interface MarkdownFormatter {
  /**
   * Escape special characters in link text
   */
  escapeLinkText: (text: string) => string;

  /**
   * Create a markdown link
   */
  linkTo: (title: string, url: string) => string;

  /**
   * Create a markdown unordered list
   */
  list: (items: any[]) => string;

  /**
   * Create a markdown task list
   */
  taskList: (items: any[]) => string;
}

export interface CustomFormat {
  /**
   * Render the custom format with the given input data
   */
  render: (input: any) => string;
}

export interface CustomFormatsProvider {
  /**
   * Get a custom format by context and slot
   * @param context - The context: 'single-link' for single links, 'multiple-links' for tab lists
   * @param slot - The slot number (e.g., '1', '2', '3')
   */
  get: (context: 'single-link' | 'multiple-links', slot: string) => Promise<CustomFormat>;
  /**
   * List formats for a context (optional capability).
   */
  list?: (context: 'single-link' | 'multiple-links') => Promise<CustomFormat[]>;
}

export interface ScriptingAPI {
  /**
   * Execute a script in a tab
   * @param options - Script execution options
   * @param options.target - Target tab and frame configuration
   * @param options.func - Function to execute (optional, use with args)
   * @param options.files - Script files to load (optional, alternative to func)
   * @param options.args - Arguments to pass to the function
   */
  executeScript: <T extends any[]>(options: {
    target: { tabId: number; allFrames?: boolean };
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
