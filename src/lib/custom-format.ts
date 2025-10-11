import Mustache from 'mustache';
import type { TabList } from './tabs';

// disable HTML escape
Mustache.escape = (text: string) => text;

export type Context = 'single-link' | 'multiple-links';

export interface RenderInputLink {
  title: string;
  url: string;
  number: number;
}

export interface RenderInputEntry {
  title: string;
  url: string;
  isGroup: boolean;
  number: number;
  links: RenderInputEntry[];
}

export interface RenderInput {
  links: RenderInputLink[];
  grouped: RenderInputEntry[];
}

export default class CustomFormat {
  context: Context;
  slot: string;
  name: string;
  template: string;
  showInMenus: boolean;

  constructor({
    context,
    slot,
    name,
    template,
    showInMenus,
  }: { context: Context; slot: string; name: string; template: string; showInMenus: boolean }) {
    this.context = context;
    this.slot = slot;
    this.name = name;
    this.template = template;
    this.showInMenus = showInMenus;
  }

  render(input: RenderInput | RenderInputLink): string {
    return Mustache.render(this.template, input);
  }

  get displayName(): string {
    return this.name.length !== 0 ? this.name : this.defaultName;
  }

  get defaultName(): string {
    return `Custom Format ${this.slot}`;
  }

  static makeRenderInputForTabLists(lists: TabList[]): RenderInput {
    const links: RenderInputLink[] = lists
      .flatMap(list => list.tabs)
      .map((tab, idx) => ({
        title: tab.title,
        url: tab.url,
        number: idx + 1,
      }));

    let number = 1;
    const grouped: RenderInputEntry[] = [];

    lists.forEach((group) => {
      if (group.isNonGroup()) {
        group.tabs.forEach((tab, idx) => {
          grouped.push({
            title: tab.title,
            url: tab.url,
            number: idx + number,
            isGroup: false,
            links: [],
          });
        });
        number += group.tabs.length;
      } else {
        grouped.push({
          isGroup: true,
          title: group.name,
          url: '',
          number,
          links: group.tabs.map((tab, jdx) => ({
            title: tab.title,
            url: tab.url,
            number: jdx + 1,
            isGroup: false,
            links: [],
          })),
        });
        number += 1;
      }
    });

    return {
      links,
      grouped,
    };
  }
}
