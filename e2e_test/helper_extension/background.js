async function openMain() {
    return chrome.windows.create({ url: `chrome-extension://${chrome.runtime.id}/main.html`});
}

chrome.action.onClicked.addListener(openMain);

chrome.commands.onCommand.addListener((command) => {
    switch (command) {
        case "open":
            openMain().then(() => console.log("ok"));
            break;
        default:
            chrome.runtime.lastError = new Error(`invalid command: ${command}`);
            break;
    }
});
