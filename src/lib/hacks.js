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
