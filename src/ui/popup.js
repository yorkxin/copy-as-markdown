import ENVIRONMENT from "environment"
import copyText from "../lib/clipboard.js"

function handler(event) {
  let element = event.currentTarget;
  let action = element.dataset.action;

  let promise;

  if (ENVIRONMENT.CAN_COPY_IN_BACKGROUND) {
    promise = browser.runtime.sendMessage({ action })
  } else {
    // for browsers don't support copy in background page (e.g. Firefox)
    // copy should be handled by promise receiver, e.g. popup page.
    promise = browser.runtime.sendMessage({ action, executeCopy: false })
      .then(markdownResponse => copyText(markdownResponse.markdown))
      // TODO: then flash badge
  }

  return promise.then(() => uiFeedback(element));
}

let uiFeedback = (element) => {
  element.classList.add('highlight-success');
  setTimeout(window.close, 300);
}

document.querySelectorAll("[data-action]")
  .forEach(element => {
    element.addEventListener("click", handler)
  })

browser.windows.getCurrent({ populate: true }).then(crWindow => {
  let tabsCount = crWindow.tabs.length
  let highlightedCount = crWindow.tabs.filter(tab => tab.highlighted).length;

  document.getElementById("count-of-all-tabs").textContent = tabsCount;
  document.getElementById("count-of-highlighted-tabs").textContent = highlightedCount;
})
