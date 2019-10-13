const DEFAULT_OPTIONS = {
  escape: false,
};

export async function save(params) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(params, resolve);
  });
}

export async function load() {
  return new Promise((resolve) => {
    chrome.storage.sync.get((result) => {
      resolve(result || DEFAULT_OPTIONS);
    });
  });
}

export function onChange(callback) {
  chrome.storage.onChanged.addListener((changes) => {
    const callbackChanges = {};

    Object.keys(DEFAULT_OPTIONS).forEach((key) => {
      callbackChanges[key] = changes[key].newValue;
    });

    callback(callbackChanges);
  });
}
