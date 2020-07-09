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

// Install listeners
document.querySelectorAll('[data-action]').forEach((element) => {
  element.addEventListener('click', async (event) => {
    const { action } = event.currentTarget.dataset;

    await doCopy(action);

    window.close();
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
