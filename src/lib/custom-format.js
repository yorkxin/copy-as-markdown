import Mustache from '../vendor/mustache.mjs';

// disable HTML escape
Mustache.escape = function (text) { return text; };

/**
 * @typedef {Object} RenderInputLink
 * @prop {String} title
 * @prop {String} url
 * @prop {Number} number
 */

/**
 * @typedef {Object} RenderInputGroup
 * @prop {String} name
 * @prop {Boolean} is_ungrouped
 * @prop {Number} number
 * @prop {RenderInputLink[]} links
 */

/**
 * @typedef {Object} RenderInput
 * @prop {RenderInputLink[]} links
 * @prop {RenderInputGroup[]} groups
 */

export default class CustomFormat {
  /**
   * @param slot {string}
   * @param name {string}
   * @param template {string}
   * @param showInPopupMenu {boolean}
   */
  constructor({
    slot,
    name,
    template,
    showInPopupMenu,
  }) {
    this.slot = slot;
    this.name = name;
    this.template = template;
    this.showInPopupMenu = showInPopupMenu;
  }

  render(input) {
    return Mustache.render(this.template, input);
  }

  /**
   *
   * @param lists {TabList[]}
   * @returns {RenderInput}
   */
  static makeRenderInput(lists) {
    /** @type {RenderInputLink[]} */
    const links = lists
      .map((list) => list.tabs.map((tab) => ({
        title: tab.title,
        url: tab.url,
      })))
      .flat()
      .map((item, idx) => ({
        ...item,
        number: idx + 1,
      }));

    /** @type {RenderInputGroup[]} */
    const groups = lists
      .map((list, idx) => ({
        name: list.name,
        is_ungrouped: list.isNonGroup(),
        number: idx + 1,
        links: list.tabs.map((tab, jdx) => ({
          title: tab.title,
          url: tab.url,
          number: jdx + 1,
        })),
      }));

    return { links, groups };
  }
}
