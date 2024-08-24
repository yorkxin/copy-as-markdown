import Mustache from '../vendor/mustache.mjs';

// disable HTML escape
Mustache.escape = function (text) { return text; };

export default class CustomFormat {
  /**
   *
   * @param name {string}
   * @param template {string}
   * @param showInPopupMenu {boolean}
   */
  constructor({
    name,
    template,
    showInPopupMenu,
  }) {
    this.name = name;
    this.template = template;
    this.showInPopupMenu = showInPopupMenu;
  }

  render(input) {
    return Mustache.render(this.template, input);
  }
}
