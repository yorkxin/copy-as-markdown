import ENVIRONMENT from "environment"
import copyText from "../lib/clipboard.js"

function handler(event) {
  let element = event.currentTarget;

  let promise;

  let payload = {
    topic: "copy",
    params: {
      action: element.dataset.action
    }
  }

  if (ENVIRONMENT.CAN_COPY_IN_BACKGROUND) {
    promise = browser.runtime.sendMessage(payload)
  } else {
    // for browsers don't support copy in background page (e.g. Firefox)
    // copy should be handled by promise receiver, e.g. popup page.
    payload.params.executeCopy = false
    promise = browser.runtime.sendMessage(payload)
      .then(markdownResponse => {
        copyText(markdownResponse.markdown)
        return markdownResponse
      })
  }

  return promise.then((markdownResponse) => uiFeedback(markdownResponse));
}

let uiFeedback = (markdownResponse) => {
  return Promise.resolve()
    .then(() => {
      return browser.runtime.sendMessage({
        topic: "badge",
        params: {
          action: "flashSuccess",
          text: String(markdownResponse.size)
        }
      })
    })
    .then(() => {
      window.close()
    })
}

document.querySelectorAll("[data-action]")
  .forEach(element => {
    element.addEventListener("click", handler)
  })

if (!ENVIRONMENT.SUPPORTS_POPUP_BROWSER_STYLE) {
  document.body.classList.add("custom-popup-style")
}

browser.windows.getCurrent({ populate: true }).then(crWindow => {
  let tabsCount = crWindow.tabs.length
  let highlightedCount = crWindow.tabs.filter(tab => tab.highlighted).length;

  document.getElementById("count-of-all-tabs").textContent = String(tabsCount);
  document.getElementById("count-of-highlighted-tabs").textContent = String(highlightedCount);
})
