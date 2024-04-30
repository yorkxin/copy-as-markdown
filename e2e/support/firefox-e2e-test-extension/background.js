async function openMain() {
    return browser.windows.create({ url: `moz-extension://${browser.runtime.id}/main.html`});
}

browser.action.onClicked.addListener(openMain);

browser.commands.onCommand.addListener((command) => {
    switch (command) {
        case "open":
            openMain().then(() => console.log("ok"));
            break;
        default:
            browser.runtime.lastError = new Error(`invalid command: ${command}`);
            break;
    }
});
