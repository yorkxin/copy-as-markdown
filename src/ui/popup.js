function handler(event) {
  let element = event.currentTarget;
  let action = element.dataset.action;

  chrome.runtime.sendMessage(action, () => {
    element.classList.add('highlight-success');
    // setTimeout(window.close, 300);
  });
}

document.querySelectorAll("[data-action]")
  .forEach(element => {
    element.addEventListener("click", handler)
  })

chrome.windows.getCurrent({ populate: true }, (crWindow) => {
  let tabsCount = crWindow.tabs.length;
  let highlightedCount = 0;

  for (let i = crWindow.tabs.length - 1; i >= 0; i--) {
    if (crWindow.tabs[i].highlighted === true) {
      highlightedCount++;
    }
  }

  document.getElementById("count-of-all-tabs").textContent = tabsCount;
  document.getElementById("count-of-highlighted-tabs").textContent = highlightedCount;
})
