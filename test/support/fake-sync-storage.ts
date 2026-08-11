/**
 * Minimal in-memory stand-in for `browser.storage.sync`, installed as the global
 * `browser` so storage-backed modules can be exercised without a real browser.
 *
 * It reproduces the two `get()` shapes the extension relies on:
 *   - array of keys  → only the keys that are actually present come back
 *   - defaults object → stored values merged over the supplied defaults
 *
 * `failNextSet` / `failNextRemove` inject one-shot write failures so partial
 * migration paths can be tested.
 */
export interface FakeSyncStorage {
  data: Record<string, unknown>;
  failNextSet: Error | null;
  failNextRemove: Error | null;
  install: () => void;
  uninstall: () => void;
}

function has(target: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

export function createFakeSyncStorage(
  initial: Record<string, unknown> = {},
): FakeSyncStorage {
  const state = {
    data: { ...initial } as Record<string, unknown>,
    failNextSet: null as Error | null,
    failNextRemove: null as Error | null,
  };

  const sync = {
    async get(query: string | string[] | Record<string, unknown>): Promise<Record<string, unknown>> {
      const keys = typeof query === 'string'
        ? [query]
        : Array.isArray(query) ? query : Object.keys(query);

      // The defaults-object form starts from the defaults; the key-list form
      // starts empty so callers can tell "absent" from "set to the default".
      const result: Record<string, unknown> = (typeof query === 'string' || Array.isArray(query))
        ? {}
        : { ...query };

      keys.forEach((key) => {
        if (has(state.data, key)) {
          result[key] = state.data[key];
        }
      });

      return result;
    },

    async set(items: Record<string, unknown>): Promise<void> {
      if (state.failNextSet) {
        const error = state.failNextSet;
        state.failNextSet = null;
        throw error;
      }
      Object.assign(state.data, items);
    },

    async remove(keys: string | string[]): Promise<void> {
      if (state.failNextRemove) {
        const error = state.failNextRemove;
        state.failNextRemove = null;
        throw error;
      }
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
        delete state.data[key];
      });
    },
  };

  return Object.assign(state, {
    install() {
      (globalThis as any).browser = { storage: { sync } };
    },
    uninstall() {
      delete (globalThis as any).browser;
    },
  });
}
