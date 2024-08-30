import Mustache from '../vendor/mustache.mjs';
import Markdown from './markdown.js';

// disable HTML escape
Mustache.escape = function (text) { return text; };

/** @typedef {import('./tabs.js').TabList} TabList */

/** @typedef {'tabs'} Context */

/**
 * @typedef {Object} RenderInputLink
 * @prop {String} title
 * @prop {String} url
 * @prop {Number} number
 */

/**
 * @typedef {Object} RenderInputEntry
 * @prop {String} title
 * @prop {String} url
 * @prop {Boolean} isGroup
 * @prop {Number} number
 * @prop {RenderInputEntry[]} links
 */

/**
 * @typedef {Object} RenderInput
 * @prop {RenderInputLink[]} links
 * @prop {RenderInputEntry[]} grouped
 */

export default class CustomFormat {
  /**
   * @param {Object} params
   * @param {Context} context
   * @param {string} params.slot
   * @param {string} params.name
   * @param {string} params.template
   * @param {boolean} params.showInMenus
   */
  constructor({
    context,
    slot,
    name,
    template,
    showInMenus,
  }) {
    this.context = context;
    this.slot = slot;
    this.name = name;
    this.template = template;
    this.showInMenus = showInMenus;
  }

  /**
   *
   * @param {RenderInput} input
   * @returns {string}
   */
  render(input) {
    return Mustache.render(this.template, input);
  }

  get displayName() {
    return this.name.length !== 0 ? this.name : this.defaultName;
  }

  get defaultName() {
    return `Custom Format ${this.slot}`;
  }

  /**
   *
   * @param {TabList[]} lists
   * @returns {RenderInput}
   */
  static makeRenderInputForTabLists(lists) {
    /** @type {RenderInputLink[]} */
    const links = lists
      .flatMap((list) => list.tabs)
      .map((tab, idx) => ({
        title: tab.title,
        url: tab.url,
        number: idx + 1,
      }));

    let number = 1;
    /** @type {RenderInputEntry[]} */
    const grouped = [];

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
          url: null,
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
