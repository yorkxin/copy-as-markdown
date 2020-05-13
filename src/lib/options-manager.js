const STORAGE_PREFIX = 'options';

const OPTION_KEYS = ['escape'];

// NOTE: LocalStorage values must be serialized as string.
const DEFAULT_OPTIONS = {
  escape: 'no', // "yes"|"no"
};

function getStorageKey(key) {
  return `${STORAGE_PREFIX}.${key}`;
}

export async function save(params) {
  return new Promise((resolve) => {
    OPTION_KEYS.forEach((key) => {
      const value = params[key];
      localStorage.setItem(getStorageKey(key), value);
    });

    resolve(params);
  });
}

export async function load() {
  return new Promise((resolve) => {
    const result = {};

    OPTION_KEYS.forEach((key) => {
      // NOTE: LocalStorage values are always string.
      // Storing boolean will result in 'true' | 'false'.
      result[key] = localStorage.getItem(getStorageKey(key)) || DEFAULT_OPTIONS[key];
    });

    resolve(result);
  });
}
