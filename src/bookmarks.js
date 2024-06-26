/* eslint-disable no-underscore-dangle , import/prefer-default-export  */

/**
 * Bookmarks handles bookmarks formatting
 */
export class Bookmarks {
  /**
   *
   * @param markdown {import("lib/markdown.js").default}
   */
  constructor({ markdown }) {
    this._markdown = markdown;
  }

  /**
   *
   * @param bookmark {browser.bookmarks.BookmarkTreeNode}
   * @returns {Array<String|String[]>}
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
   * @param bookmark {browser.bookmarks.BookmarkTreeNode}
   * @returns {String|String[]|string}
   */
  toMarkdown(bookmark) {
    const tree = this.aggregate(bookmark);

    if (tree.length === 1) {
      return tree[0];
    }

    return this._markdown.list(tree);
  }
}
