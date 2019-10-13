import * as OptionsManager from '../../lib/options-manager.js';

const ESCAPE_CHARS = /([\\`*_[\]<>])/g;
const DEFAULT_TITLE = '(No Title)';

function escapeLinkText(text) {
  return text.replace(ESCAPE_CHARS, '\\$1');
}

let userOptions = {};

// load options
OptionsManager.load().then((options) => {
  userOptions = options;
});

OptionsManager.onChange((changes) => {
  Object.keys(changes).forEach((key) => {
    userOptions[key] = changes[key];
  });
});

export function linkTo(title = DEFAULT_TITLE, url, { needEscape = true } = {}) {
  let normalizedTitle = title;

  // used for copying link-in-image
  if (needEscape && userOptions.escape) {
    normalizedTitle = escapeLinkText(title);
  }

  return `[${normalizedTitle}](${url})`;
}

export function imageFor(title, url) {
  return `![${title}](${url})`;
}

export function list(theList) {
  return theList.map((item) => `* ${item}`).join('\n');
}

export function links(theLinks, options = {}) {
  return list(theLinks.map((link) => linkTo(link.title, link.url, options)));
}
