/* eslint-disable no-underscore-dangle , import/prefer-default-export  */

/**
 * @typedef {function(string): Promise<chrome.bookmarks.BookmarkTreeNode[]>} FnBookmarksGetSubtree
 * @exports FnBookmarksGetSubtree
 */

export class WebExt {
  /** @type {FnBookmarksGetSubtree} */
  static async bookmarksGetSubtree(id) {
    return new Promise((resolve, reject) => {
      try {
        chrome.bookmarks.getSubTree(id, (bookmarks) => {
          if (!bookmarks) {
            reject(new Error(`got nil (${typeof bookmarks})`));
          } else {
            resolve(bookmarks);
          }
        });
      } catch (e) {
        reject(new Error('bookmarks.getSubtree failed:', { cause: e }));
      }
    });
  }
}
