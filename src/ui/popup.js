function sendMessageToBackgroundPage(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, () => {
      // NOTE: there will be no response content even if the execution was successful
      resolve(true)
    });
  });
}

function doCopy(action) {
  return sendMessageToBackgroundPage({
    topic: "copy",
    params: {
      action: action
    }
  })
}

async function showSuccessBadge() {
  return sendMessageToBackgroundPage({
    topic: "badge",
    params: {
      action: "flashSuccess"
    }
  })
}

async function handler(event) {
  await doCopy(event.currentTarget.dataset.action);
  await showSuccessBadge();
  window.close();
}

// Install listeners
for (const element of document.querySelectorAll("[data-action]")) {
  element.addEventListener("click", handler)
}

document.body.classList.add("custom-popup-style")

chrome.windows.getCurrent({ populate: true }, (crWindow) => {
  let tabsCount = crWindow.tabs.length
  let highlightedCount = crWindow.tabs.filter(tab => tab.highlighted).length;

  document.querySelectorAll("[data-count=all-tabs]").forEach(element => {
    element.textContent = String(tabsCount);
  })

  document.querySelectorAll("[data-count=highlighted-tabs]").forEach(element => {
    element.textContent = String(highlightedCount);
  })
})
