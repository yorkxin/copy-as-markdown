// This file is a workaround for Firefox event page.
// It is executed every time background.js is loaded.
//
// In Chrome/Chromium, browsers, the suggested way to create a context menu is calling
// `chrome.contextMenu.create()` in `chrome.runtime.onInstalled()`. This function will be called
// when browser is restarted.
//
// In Firefox, the behavior is slightly different, such that onInstalled() is called ONLY at the
// first time the add-on is installed. It is NOT called when the browser is restarted.
//
// As a workaround, in Firefox, call contextMenus.create() everytime background.js is loaded.
//
// For more details, see the following issues on Firefox's bug tracker:
//
// * https://bugzilla.mozilla.org/show_bug.cgi?id=1567467
// * https://bugzilla.mozilla.org/show_bug.cgi?id=1558336

chrome.contextMenus.create({
  id: 'current-page',
  title: 'Copy [Page Title](URL)',
  type: 'normal',
  contexts: ['page'],
});

chrome.contextMenus.create({
  id: 'link',
  title: 'Copy [Link Content](URL)',
  type: 'normal',
  contexts: ['link'],
});

chrome.contextMenus.create({
  id: 'image',
  title: 'Copy ![](Image URL)', // TODO: how to fetch alt text?
  type: 'normal',
  contexts: ['image'],
});
