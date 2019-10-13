function sendMessageToBackgroundPage(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, () => {
      // NOTE: there will be no response content even if the execution was successful
      resolve(true)
    });
  });
}

async function doCopy(action) {
  return await sendMessageToBackgroundPage({
    topic: "copy",
    params: {
      action: action
    }
  })
}

async function showSuccessBadge() {
  return await sendMessageToBackgroundPage({
    topic: "badge",
    params: {
      action: "flashSuccess"
    }
  })
}

function handler(event) {
  doCopy(event.currentTarget.dataset.action);
  showSuccessBadge();
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
