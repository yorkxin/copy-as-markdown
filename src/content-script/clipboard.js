import copyText from "../lib/clipboard.js"

browser.runtime.onMessage.addListener(request => {
  return copyText(request.text)
});
