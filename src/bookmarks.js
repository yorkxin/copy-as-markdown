/* eslint-disable no-underscore-dangle , import/prefer-default-export  */

/**
 * Bookmarks handles bookmarks formatting
 */
export class Bookmarks {
  /**
   *
   * @param {Object} params - The parameters
   * @param {import("./lib/markdown.js").default} params.markdown - The markdown instance
   */
  constructor({ markdown }) {
    this._markdown = markdown;
  }

  /**
   *
   * @param {browser.bookmarks.BookmarkTreeNode} bookmark
   * @returns {import("./lib/markdown.js").NestedArray}
   */
  aggregate(bookmark) {
    if (bookmark.url) {
      // an actual bookmark, not a folder, return
      return [this._markdown.linkTo(bookmark.title, bookmark.url)];
    }

    // it is a folder, for sure

    // empty folder
    if (typeof bookmark.children === 'undefined') {
      return [bookmark.title];
    }

    // folder, traverse
    const children = bookmark.children.map((bm) => this.aggregate(bm));
    if (children.length === 0) {
      return [bookmark.title];
    }
    return [bookmark.title, children];
  }

  /**
   *
   * @param {browser.bookmarks.BookmarkTreeNode} bookmark
   * @returns {string}
   */
  toMarkdown(bookmark) {
    const tree = this.aggregate(bookmark);

    if (tree.length === 1) {
      return tree[0];
    }

    return this._markdown.list(tree);
  }
}
