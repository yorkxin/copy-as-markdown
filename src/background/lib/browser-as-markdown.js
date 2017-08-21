// Convert browser items (tabs / window / etc.) to Markdown
import OptionsManager from "../../lib/options-manager.js";
import aBrowser from "../../lib/async-browser.js";
import Markdown from "./markdown.js";

var globalOptions = {};

// load options
OptionsManager.load(function(newOptions) {
  globalOptions = newOptions;
});

OptionsManager.onChange(function(changes) {
  for (let key in changes) {
    globalOptions[key] = changes[key];
  }
});

export function currentTab(options) {
  return aBrowser.getCurrent()
    .then(tab => Markdown.linkTo(tab.title, tab.url, options))
}

export function allTabs(options) {
  return aBrowser.queryTabs({ currentWindow: true })
    .then(links => Markdown.links(links, options))
}

export function copyHighlightedTabs(options) {
  return aBrowser.queryTabs({ currentWindow: true, highlighted: true })
    .then(links => Markdown.links(links, options))
}

export default {
  currentTab,
  allTabs,
  copyHighlightedTabs
}
