const DEFAULT_TITLE = '(No Title)';

// TODO: re-implement escape feature for copying link-in-image (???)

export function linkTo(title = DEFAULT_TITLE, url) {
  return `[${title}](${url})`;
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
