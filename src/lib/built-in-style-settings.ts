export type BuiltInStyleKey
  = | 'singleLink'
    | 'tabLinkList'
    | 'tabTaskList'
    | 'tabTitleList'
    | 'tabUrlList';

export interface BuiltInStyleSettings {
  singleLink: boolean;
  tabLinkList: boolean;
  tabTaskList: boolean;
  tabTitleList: boolean;
  tabUrlList: boolean;
}

const StorageKeys: Record<BuiltInStyleKey, string> = {
  singleLink: 'builtin.style.singleLink',
  tabLinkList: 'builtin.style.tabLinkList',
  tabTaskList: 'builtin.style.tabTaskList',
  tabTitleList: 'builtin.style.tabTitleList',
  tabUrlList: 'builtin.style.tabUrlList',
};

const defaultSettings: BuiltInStyleSettings = {
  singleLink: true,
  tabLinkList: true,
  tabTaskList: true,
  tabTitleList: true,
  tabUrlList: true,
};

function toStorage(settings: BuiltInStyleSettings): Record<string, boolean> {
  return {
    [StorageKeys.singleLink]: settings.singleLink,
    [StorageKeys.tabLinkList]: settings.tabLinkList,
    [StorageKeys.tabTaskList]: settings.tabTaskList,
    [StorageKeys.tabTitleList]: settings.tabTitleList,
    [StorageKeys.tabUrlList]: settings.tabUrlList,
  };
}

export default {
  keys: Object.values(StorageKeys),
  defaultSettings,

  async getAll(): Promise<BuiltInStyleSettings> {
    const stored = await browser.storage.sync.get(toStorage(defaultSettings));

    return {
      singleLink: Boolean(stored[StorageKeys.singleLink]),
      tabLinkList: Boolean(stored[StorageKeys.tabLinkList]),
      tabTaskList: Boolean(stored[StorageKeys.tabTaskList]),
      tabTitleList: Boolean(stored[StorageKeys.tabTitleList]),
      tabUrlList: Boolean(stored[StorageKeys.tabUrlList]),
    };
  },

  async set(key: BuiltInStyleKey, value: boolean): Promise<void> {
    await browser.storage.sync.set({ [StorageKeys[key]]: value });
  },
};
