function handler(event) {
  let element = event.currentTarget;
  let action = element.dataset.action;

  chrome.runtime.sendMessage(action, () => {
    element.classList.add('highlight-success');
    setTimeout(window.close, 300);
  });
}

document.querySelectorAll("[data-action]")
  .forEach(element => {
    element.addEventListener("click", handler)
  })

chrome.windows.getCurrent({ populate: true }, crWindow => {
  let tabsCount = crWindow.tabs.length
  let highlightedCount = crWindow.tabs.filter(tab => tab.highlighted).length;

  document.getElementById("count-of-all-tabs").textContent = tabsCount;
  document.getElementById("count-of-highlighted-tabs").textContent = highlightedCount;
})
