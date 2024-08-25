// eslint-disable-next-line max-classes-per-file
export class Tab {
  constructor(title, url, groupId) {
    this.title = title;
    this.url = url;
    this.groupId = groupId;
  }
}

export class TabGroup {
  constructor(title, id, color) {
    this.title = title;
    this.id = id;
    this.color = color;
  }

  getTitle() {
    if (this.title === '') {
      return `Untitled ${this.color} group`;
    }
    return this.title;
  }
}

TabGroup.NonGroupId = (Object.hasOwn(chrome, 'tabGroups')) ? chrome.tabGroups.TAB_GROUP_ID_NONE : -1;

export class TabList {
  /**
   * @param name {string}
   * @param groupId {number}
   * @param tabs {Tab[]}
   */
  constructor(name, groupId, tabs) {
    this.name = name;
    this.groupId = groupId;
    this.tabs = tabs;
  }

  /**
   * Represents a list of tabs that are not grouped.
   * @param tabs {Tab[]}
   */
  static nonGroup(tabs) {
    return new TabList('', TabGroup.NonGroupId, tabs);
  }

  /**
   * @return {boolean}
   */
  isNonGroup() {
    return this.groupId === TabGroup.NonGroupId;
  }
}

export class TabListGrouper {
  /**
   *
   * @param groups {TabGroup[]}
   */
  constructor(groups) {
    /** @type {Map<number,TabGroup>} */
    this.groupIndex = new Map();
    groups.forEach((group) => {
      this.groupIndex.set(group.id, group);
    });
  }

  /**
   *
   * @param tabs {Tab[]}
   * @return {TabList[]}
   */
  collectTabsByGroup(tabs) {
    if (tabs.length === 0) {
      return [];
    }

    /** @type {TabList[]} */
    const collection = [];

    /** @type {TabList|null} */
    let currentGroup = this.makeTabListGroup(tabs[0]);

    for (let i = 1; i < tabs.length; i += 1) {
      const tab = tabs[i];
      if (tab.groupId !== currentGroup.groupId) {
        collection.push(currentGroup);
        currentGroup = this.makeTabListGroup(tab);
      } else {
        currentGroup.tabs.push(tab);
      }
    }

    collection.push(currentGroup);

    return collection;
  }

  /**
   *
   * @param tab {Tab}
   * @return {TabList}
   */
  makeTabListGroup(tab) {
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
