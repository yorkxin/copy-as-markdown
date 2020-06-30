function sendMessageToBackgroundPage(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, () => {
      // NOTE: there will be no response content even if the execution was successful
      resolve(true);
    });
  });
}

async function doCopy(action) {
  return sendMessageToBackgroundPage({
    topic: 'copy',
    params: {
      action,
    },
  });
}

async function showBadge(type) {
  return sendMessageToBackgroundPage({
    topic: 'badge',
    params: {
      type,
    },
  });
}

// Install listeners
document.querySelectorAll('[data-action]').forEach((element) => {
  element.addEventListener('click', async (event) => {
    const { action } = event.currentTarget.dataset;

    // NOTE: Firefox requires permission request to happen in a user interaction callback.
    // Do not move this to background JS.
    chrome.permissions.request({ permissions: ['tabs'] }, async (granted) => {
      if (granted) {
        await doCopy(action);
      } else {
        await showBadge('fail');
      }

      window.close();
    });
  });
});

document.body.classList.add('custom-popup-style');

chrome.windows.getCurrent({ populate: true }, (crWindow) => {
  const tabsCount = crWindow.tabs.length;
  const highlightedCount = crWindow.tabs.filter((tab) => tab.highlighted).length;

  const displayCountOfAllTabs = document.getElementById('display-count-all-tabs');
  displayCountOfAllTabs.textContent = String(tabsCount);

  const displayCountOfHighlightedTabs = document.getElementById('display-count-highlighted-tabs');
  displayCountOfHighlightedTabs.textContent = String(highlightedCount);
});
