export class Tab {
  title: string;
  url: string;
  groupId: number;

  constructor(title: string, url: string, groupId: number) {
    this.title = title;
    this.url = url;
    this.groupId = groupId;
  }
}

export class TabGroup {
  title: string;
  id: number;
  color: string;

  static NonGroupId = -1;

  constructor(title: string, id: number, color: string) {
    this.title = title;
    this.id = id;
    this.color = color;
  }

  getTitle(): string {
    if (this.title === '') {
      return `Untitled ${this.color} group`;
    }
    return this.title;
  }
}

export class TabList {
  name: string;
  groupId: number;
  tabs: Tab[];

  constructor(name: string, groupId: number, tabs: Tab[]) {
    this.name = name;
    this.groupId = groupId;
    this.tabs = tabs;
  }

  /**
   * Represents a list of tabs that are not grouped.
   */
  static nonGroup(tabs: Tab[]): TabList {
    return new TabList('', TabGroup.NonGroupId, tabs);
  }

  isNonGroup(): boolean {
    return this.groupId === TabGroup.NonGroupId;
  }
}

export class TabListGrouper {
  groupIndex: Map<number, TabGroup>;

  constructor(groups: TabGroup[]) {
    this.groupIndex = new Map();
    groups.forEach((group) => {
      this.groupIndex.set(group.id, group);
    });
  }

  collectTabsByGroup(tabs: Tab[]): TabList[] {
    if (tabs.length === 0) {
      return [];
    }

    const collection: TabList[] = [];
    const firstTab = tabs[0];
    if (!firstTab) return [];

    let currentGroup: TabList = this.makeTabListGroup(firstTab);

    for (let i = 1; i < tabs.length; i += 1) {
      const tab = tabs[i];
      if (tab && tab.groupId !== currentGroup.groupId) {
        collection.push(currentGroup);
        currentGroup = this.makeTabListGroup(tab);
      } else if (tab) {
        currentGroup.tabs.push(tab);
      }
    }

    collection.push(currentGroup);

    return collection;
  }

  makeTabListGroup(tab: Tab): TabList {
    if (tab.groupId === TabGroup.NonGroupId) {
      // no group
      return TabList.nonGroup([tab]);
    }

    if (!this.groupIndex.has(tab.groupId)) {
      return TabList.nonGroup([tab]);
    }

    const group = this.groupIndex.get(tab.groupId);

    if (!group) {
      throw new Error(`no such group: ${tab.groupId}`);
    }

    return new TabList(group.getTitle(), group.id, [tab]);
  }
}
