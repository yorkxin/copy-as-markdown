import MarkdownResponse from "./markdown-response.js";

const ESCAPE_CHARS = /([\\`*_[\]<>])/g;
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

  let markdown = `[${title}](${url})`;

  return new MarkdownResponse({ markdown, size: 1 });
}

export function imageFor(title, url) {
  let markdown = `![${title}](${url})`;

  return new MarkdownResponse({ markdown, size: 1 });
}

export function links(links, escape = false) {
  let markdown = links.map(function(link) {
    return "* " + linkTo(link.title, link.url, escape);
  }).join("\n");

  return new MarkdownResponse({ markdown, size: links.length });
}

export default {
  linkTo,
  imageFor,
  links
};
