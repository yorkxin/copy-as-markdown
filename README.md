# Copy as Markdown for Chrome & Firefox

Do you often type Markdown code manually for a link or image, or even all tabs in a window, and feel tired? **Copy as Markdown** can help you!

## Download

* Google Chrome: [Chrome Web Store - Copy as Markdown](https://chrome.google.com/webstore/detail/copy-as-markdown/fkeaekngjflipcockcnpobkpbbfbhmdn)
* Firefox: [Copy as Markdown :: Add-ons for Firefox](https://addons.mozilla.org/firefox/addon/copy-as-markdown/)
* Microsoft Edge: [Copy as Markdown - Microsoft Edge Addons](https://microsoftedge.microsoft.com/addons/detail/copy-as-markdown/cbbdkefgbfifiljnnklfhnhcnlmpglpd)

## Features

**Copy as Markdown** is a browser extension that helps you copy the following things as Markdown to your system clipboard:

On the web page:

:ballot_box_with_check: Selection Text as Markdown<br>
:ballot_box_with_check: A Link on the Page<br>
:ballot_box_with_check: An Image on the Page, with or without wrapping link

Exporting tabs in the current window, either all or highlighted tabs:

:ballot_box_with_check: Current Tab as Link<br>
:ballot_box_with_check: List of Links<br>
:ballot_box_with_check: Task List (for GitHub-Flavored Markdown)<br>
:ballot_box_with_check: With Tab Grouping (in Chrome, Edge etc.)

## Keyboard Shortcuts

You can add keyboard shortcuts for copying tab(s) as Markdown. By default, Copy as Markdown does not assign any keyboard shortcuts.

### Firefox

Please refer to this Firefox Help: <https://support.mozilla.org/en-US/kb/manage-extension-shortcuts-firefox>

### Chrome

The Keyboard Shortcuts of extensions can be found at `chrome://extensions/shortcuts` URL. (Paste and open the link in the Location Bar).

## Known Issues

* [Chrome] When copying an image, the image code does not include the alternative text of that image. This is due to API restrictions.

## Development

Here is the folder structure. The platform-specific folders are used to resolve browser inconsistencies.

```
src/               # Shared Source Code
  lackground.ts
  ...
chrome/            # Chrome / Chromium files
  dist/            # ../src will be copied here
  mainfest.json
  ...
firefox/           # Firefox Manifest V2 files
  dist/            # ../src will be copied here
  mainfest.json
  background.html  # Loads ESModule
  ...
firefox-mv3/       # Firefox Manifest V3 files
  dist/            # ../src will be copied here
  mainfest.json
  ...
e2e_test/          # E2E Tests
```  

### Install dependencies

```
npm install -g web-ext
npm install
```

### Debugging

Use the script `scripts/debug.js` that runs an auto-reload process. Usage:

```sh
npm debug-chrome
npm debug-firefox
npm debug-firefox-mv3
```

For manual debugging without auto-reload:

- Chrome: [Window] Menu -> Extensions -> Load unpacked extension
- Firefox: [Tools] Menu -> Add-ons -> [Gear] Icon -> Debug Add-ons -> Load Temporary Add-on

#### Debug with Firefox XPI Package

To debug some behaviors such as Firefox restarts (for example, are context menus installed properly),
it is necessary to build an XPI package and install it on Firefox. Temporary Add-Ons won't be enough
because they get uninstalled after Firefox quits.

Firefox checks the signature when installing XPI. To do so,

1. Grab [API keys](https://addons.mozilla.org/en-US/developers/addon/api/key/) from Firefox Add-On
2. Bump version in `manifest.json`. Note that AMO only accepts version numbers in `X.Y.Z` format where all 3 segments are numbers without zero prefixes.
3. Run:

    ```shell
    web-ext sign --channel=unlisted --api-key=... --api-secret=...
    ```

It'll create an XPI that is signed with your Firefox Add-Ons account. The file will also be
uploaded to Add-On Developer Hub as unlisted.

Note that Firefox Add-On keeps track of all the versions that have ever been uploaded, including
'self-distributed' (`channel=unlisted`).

See <https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/>

### Unit Tests

Unit tests are under `./test/**/*.test.ts`.

To run, use `npm test`.

### E2E Tests

Using Selenium (Python). Please refer to [e2e_test/](./e2e_test) folder.

### QA

There is a [qa.html](./fixtures/qa.html) that includes various edge test cases. Open it in the browser, then try Copy as Markdown with the content in it.

## License

See [MIT-LICENSE.txt](./MIT-LICENSE.txt)
