import * as OptionsManager from '../lib/options-manager.js';

const ESCAPE_CHARS = /([\\`*_[\]<>])/g;
const DEFAULT_TITLE = '(No Title)';

function escapeLinkText(text) {
  return text.replace(ESCAPE_CHARS, '\\$1');
}

function getDateString() {
  var date = new Date();
  var y = date.getFullYear();
  var m = date.getMonth() + 1;
  m = m < 10 ? '0' + m : m;
  var d = date.getDate();
  d = d < 10 ? ('0' + d) : d;
  return '[' + y + '-' + m + '-' + d + '] ';
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

  let dateStr = "";
  if (userOptions.addDate === 'yes') {
    dateStr = getDateString();
  }

  return `[${dateStr}${normalizedTitle}](${url})`;
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
