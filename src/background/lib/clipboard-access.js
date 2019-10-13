async function getCurrentActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ currentWindow: true, active: true }, (result) => {
      resolve(result[0]);
    });
  })
}

async function copyByContentScript(text) {
  const tab = await getCurrentActiveTab()

  return new Promise((resolve, reject) => {
    chrome.tabs.executeScript(tab.id, { file: '/content-script/clipboard.js' }, () => {
      chrome.tabs.sendMessage(tab.id, { text }, (response) => {
        if (response) {
          resolve(response);
        } else {
          reject(chrome.runtime.lastError.message)
        }
      });
    })
  })
}

/**
 *
 * @param {MarkdownResponse} response generated from markdown.js
 * @return {Promise} contains original response
 */
export async function copyMarkdownResponse(response) {
  await copyByContentScript(response.markdown)
}
