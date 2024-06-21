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

WebExt.storage = {
  session: {
    /**
     *
     * @param keys {string|string[]}
     * @returns {Promise<Object<string,any>>}
     */
    async get(keys) {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.session.get(keys, (ok) => {
            resolve(ok);
          });
        } catch (e) {
          reject(e);
        }
      });
    },
    /**
     * @param {Object<string,any>} items
     * @return {Promise<null>}
     */
    async set(items) {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.session.set(items, () => {
            resolve(null);
          });
        } catch (e) {
          reject(e);
        }
      });
    },
    /**
     * @param {string|string[]} keys
     * @return {Promise<null>}
     */
    async remove(keys) {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.session.remove(keys, () => {
            resolve(null);
          });
        } catch (e) {
          reject(e);
        }
      });
    },
  },
};

WebExt.permissions = {
  /**
   *
   * @param permission {string}
   * @returns {Promise<'yes','no','unavailable'>}
   */
  async contain(permission) {
    return new Promise((resolve) => {
      const optionalPermissions = chrome.runtime.getManifest().optional_permissions;

      if (optionalPermissions && !optionalPermissions.find((e) => e === permission)) {
        resolve('unavailable');
      }

      try {
        chrome.permissions.contains({ permissions: [permission] }, (ok) => {
          if (ok) {
            resolve('yes');
          }

          resolve('no');
        });
      } catch (e) {
        resolve('unavailable');
      }
    });
  },

  /**
   *
   * @param permissions {string[]}
   * @return {Promise<boolean>}
   */
  async allGranted(permissions) {
    const statuses = await Promise.all(permissions.map((perm) => this.contain(perm)));
    return statuses.every((status) => status === 'yes');
  },

  /**
   * chrome.permissions in Firefox MV2 does not return a Promise, so wraps the API with Promise.
   *
   * @param permissions {string[]}
   * @returns {Promise<boolean>}
   */
  async request(permissions) {
    return new Promise((resolve, reject) => {
      try {
        chrome.permissions.request({ permissions }, (ok) => {
          resolve(ok);
        });
      } catch (e) {
        reject(e);
      }
    });
  },

  /**
   * chrome.permissions in Firefox MV2 does not return a Promise, so wraps the API with Promise.
   *
   * @param permissions {string[]}
   * @returns {Promise<boolean>}
   */
  async remove(permissions) {
    return new Promise((resolve, reject) => {
      try {
        chrome.permissions.remove({ permissions }, (ok) => {
          resolve(ok);
        });
      } catch (e) {
        reject(e);
      }
    });
  },
};
