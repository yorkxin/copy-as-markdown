/**
 * Async wrapper around chrome.tabs.query function.
 *
 * This is a workaround for Firefox (102), whose `chrome.tabs.query` was not properly implemented.
 * `await browser.tabs.query()` works though, but `browser` object is not compatible with Chromium.
 *
 * @param query {chrome.tabs.QueryInfo}
 * @returns {Promise<chrome.tabs.Tab[]>}
 */
// eslint-disable-next-line import/prefer-default-export
export async function asyncTabsQuery(query) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.query(query, (tabs) => {
        if (!tabs) {
          reject(new Error(`got nil (${typeof tabs})`));
        } else {
          resolve(tabs);
        }
      });
    } catch (e) {
      reject(new Error('tabs.query failed:', { cause: e }));
    }
  });
}

/**
 * Async wrapper around chrome.bookmarks.getSubtree() function.
 *
 * This is a workaround for Firefox MV2, whose `chrome.bookmarks.getSubtree()` does not return a
 * Promise.
 *
 * @param id {string}
 * @returns {Promise<chrome.bookmarks.BookmarkTreeNode[]>}
 */
// eslint-disable-next-line import/prefer-default-export
export async function asyncBookmarksGetSubtree(id) {
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
