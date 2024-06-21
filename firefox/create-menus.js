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
  title: 'Copy Page Link as Markdown',
  type: 'normal',
  contexts: [
    'page',
    'tab', // only available on Firefox
  ],
});

chrome.contextMenus.create({
  id: 'link',
  title: 'Copy Link as Markdown',
  type: 'normal',
  contexts: ['link'],
});

chrome.contextMenus.create({
  id: 'image',
  title: 'Copy Image as Markdown', // TODO: how to fetch alt text?
  type: 'normal',
  contexts: ['image'],
});

chrome.contextMenus.create({
  id: 'selection-as-markdown',
  title: 'Copy Selection as Markdown',
  type: 'normal',
  contexts: ['selection'],
});

/* The following menu items are Firefox-only */

browser.contextMenus.create({
  id: 'separator-1',
  type: 'separator',
  contexts: ['tab'],
});

function addTabsContextMenu() {
  browser.contextMenus.create({
    id: 'all-tabs-list',
    title: 'Copy All Tabs',
    type: 'normal',
    contexts: ['tab'],
  });

  browser.contextMenus.create({
    id: 'all-tabs-task-list',
    title: 'Copy All Tabs (Task List)',
    type: 'normal',
    contexts: ['tab'],
  });

  browser.contextMenus.create({
    id: 'separator-2',
    type: 'separator',
    contexts: ['tab'],
  });

  browser.contextMenus.create({
    id: 'highlighted-tabs-list',
    title: 'Copy Selected Tabs',
    type: 'normal',
    contexts: ['tab'],
  });

  browser.contextMenus.create({
    id: 'highlighted-tabs-task-list',
    title: 'Copy Selected Tabs (Task List)',
    type: 'normal',
    contexts: ['tab'],
  });
}

async function removeTabsContextMenu() {
  await browser.contextMenus.remove('all-tabs-list');
  await browser.contextMenus.remove('all-tabs-task-list');
  await browser.contextMenus.remove('separator-2');
  await browser.contextMenus.remove('highlighted-tabs-list');
  await browser.contextMenus.remove('highlighted-tabs-task-list');
}

browser.permissions.contains({ permissions: ['tabs'] })
  .then((ok) => {
    if (ok) {
      addTabsContextMenu();
    }
  });

browser.permissions.onAdded.addListener((e) => {
  if (e.permissions.includes('tabs')) {
    addTabsContextMenu();
  }
});

browser.permissions.onRemoved.addListener(async (e) => {
  if (e.permissions.includes('tabs')) {
    await removeTabsContextMenu();
  }
});

chrome.contextMenus.create({
  id: 'bookmark-link',
  title: 'Copy Bookmark or Folder as Markdown',
  type: 'normal',
  contexts: ['bookmark'],
});
