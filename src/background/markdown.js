import * as OptionsManager from '../lib/options-manager.js';

const ESCAPE_CHARS = /([\\`*_[\]<>])/g;
const DEFAULT_TITLE = '(No Title)';

function escapeLinkText(text) {
  return text.replace(ESCAPE_CHARS, '\\$1');
}

function normalizeUrl(url, escapeRegex = /\s/g) {
  // Decode encoded URL characters
  url = decodeURI(url);
  // Encode URL characters we still want to escape
  return url.replace(escapeRegex, (match) => {
    // `encodeURIComponent()` misses characters like `(`, `)`
    return `%${match.charCodeAt(0).toString(16)}`;
  });
}

let userOptions = {};

async function reloadOptions() {
  userOptions = await OptionsManager.load();
  console.debug(userOptions);
}

reloadOptions();

window.addEventListener('storage', () => {
  reloadOptions();
});

export function linkTo(title = DEFAULT_TITLE, url, { needEscape = true } = {}) {
  let normalizedTitle = title;

  // used for copying link-in-image
  if (needEscape && userOptions.escape === 'yes') {
    normalizedTitle = escapeLinkText(title);
  }

  const normalizedUrl = normalizeUrl(url, /\s|[()]/g);
  return `[${normalizedTitle}](${normalizedUrl})`;
}

export function imageFor(title, url) {
  return `![${title}](${url})`;
}

export function list(theList) {
  return theList.map((item) => `* ${normalizeUrl(item)}`).join('\n');
}

export function links(theLinks, options = {}) {
  return list(theLinks.map((link) => linkTo(link.title, link.url, options)));
}
