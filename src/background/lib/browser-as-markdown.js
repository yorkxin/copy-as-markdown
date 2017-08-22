// Convert browser items (tabs / window / etc.) to Markdown
import OptionsManager from "../../lib/options-manager.js";
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

export function currentTab(options = {}) {
  return new Promise((resolve) => {
    chrome.tabs.query({ currentWindow: true, active: true }, tabs => {
      resolve(Markdown.linkTo(tabs[0].title, tabs[0].url, options))
    })
  })
}

export function allTabs(options = {}) {
  return new Promise((resolve) => {
    chrome.tabs.query({ currentWindow: true }, tabs => {
      resolve(Markdown.links(tabs, options))
    })
  })
}

export function highlightedTabs(options = {}) {
  return new Promise((resolve) => {
    chrome.tabs.query({ currentWindow: true, highlighted: true }, tabs => {
      resolve(Markdown.links(tabs, options))
    })
  })
}

export default {
  currentTab,
  allTabs,
  highlightedTabs
}
