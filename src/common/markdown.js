const ESCAPE_CHARS = /([\\`*_\[\]<>])/g;
const DEFAULT_TITLE = "(No Title)";

var escapeLinkText = function(text) {
  return text.replace(ESCAPE_CHARS, "\\$1");
};

export function linkTo(title, url, escape = false) {
  if (title === undefined) {
    title = DEFAULT_TITLE;
  }

  // used for copying link-in-image
  if (escape) {
    title = escapeLinkText(title);
  }

  return `[${title}](${url})`;
};

export function imageFor(title, url) {
  return `![${title}](${url})`;
}

export function list(links, escape = false) {
  return links.map(function(link) {
    return "* " + linkTo(link.title, link.url, escape);
  }).join("\n");
};

export default {
  linkTo,
  imageFor,
  list
};
