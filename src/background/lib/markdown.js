import MarkdownResponse from "./markdown-response.js";
import OptionsManager from "../../lib/options-manager.js";

const ESCAPE_CHARS = /([\\`*_[\]<>])/g;
const DEFAULT_TITLE = "(No Title)";

var escapeLinkText = function(text) {
  return text.replace(ESCAPE_CHARS, "\\$1");
};

var userOptions = {};

// load options
OptionsManager.load().then(options => userOptions = options)

OptionsManager.onChange(changes => {
  for (let key in changes) {
    userOptions[key] = changes[key];
  }
})

export function linkTo(title, url, { needEscape = true } = {}) {
  if (title === undefined) {
    title = DEFAULT_TITLE;
  }

  // used for copying link-in-image
  if (needEscape && userOptions.escape) {
    title = escapeLinkText(title);
  }

  let markdown = `[${title}](${url})`;

  return new MarkdownResponse({ markdown, size: 1 });
}

export function imageFor(title, url) {
  let markdown = `![${title}](${url})`;

  return new MarkdownResponse({ markdown, size: 1 });
}

export function links(links, options = {}) {
  let markdown = links
    .map(link => "* " + linkTo(link.title, link.url, options).markdown)
    .join("\n");

  return new MarkdownResponse({ markdown, size: links.length });
}

export default {
  linkTo,
  imageFor,
  links
};
