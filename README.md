# Copy as Markdown for Chrome & Firefox

Do you often type Markdown code manually for a link or image, or even all tabs in a window, and feel tired? **Copy as Markdown** can help you!

## Download

* Google Chrome: [Chrome Web Store - Copy as Markdown](https://chrome.google.com/webstore/detail/copy-as-markdown/fkeaekngjflipcockcnpobkpbbfbhmdn)
* Firefox: [Copy as Markdown :: Add-ons for Firefox](https://addons.mozilla.org/firefox/addon/copy-as-markdown/)
* Microsoft Edge: [Copy as Markdown - Microsoft Edge Addons](https://microsoftedge.microsoft.com/addons/detail/copy-as-markdown/cbbdkefgbfifiljnnklfhnhcnlmpglpd)

## Features

**Copy as Markdown** is a browser extension helps you copy the following things as Markdown to your system clipboard:

:ballot_box_with_check: Current Tab as Link<br>
:ballot_box_with_check: A Link in the Page<br>
:ballot_box_with_check: An Image in the Page<br>
:ballot_box_with_check: An Image that is wrapped with a Link<br>
:ballot_box_with_check: All Tabs as a List of Links<br>
:ballot_box_with_check: Highlighted Tabs as a List of Links

## Keyboard Shortcuts

You can add keyboard shortuts for copying tab(s) as Markdown. By default, Copy as Markdown does not assign any keyboard shortcuts.

### Firefox

Please refer to this Firefox Help: https://support.mozilla.org/en-US/kb/manage-extension-shortcuts-firefox

### Chrome

The Keyboard Shortcuts of extensions can be found at `chrome://extensions/shortcuts` URL. (Paste and open the link in the Location Bar).

## Known Issues

* [Chrome] When copying an image, the image code does not include the alternative text of that image. This is due to API restriction.

## Development

Here is the forder structure. Platform-specific folder is used to resolve browser inconsistencies.

```
src/               # Shared Source Code
  background.js
  ...
chrome/            # Chrome / Chromium files
  dist/            # ../src will be copied here
  mainfest.json
  ...
firefox-mv2/       # Firefox Manifest V2 files
  dist/            # ../src will be copied here
  mainfest.json
  background.html  # Loads ESModule
  ...
firefox/           # Firefox Manifest V3 files
  dist/            # ../src will be copied here
  mainfest.json
  background.html  # Loads ESModule
  ...
compile.sh         # Copies src/**/* to <platform>/dist/
```  

### Install dependencies

```
npm install -g web-ext
npm install
```

### Debugging

Since the source code are copied to platform-specific folders by `compile.sh`, it is recommended to use the auto-reload test script.

```sh
npm debug-chrome
npm debug-firefox
npm debug-firefox-mv3   // Requires Firefox Developer Edition
```

For manual debugging without auto-reload:

- Chrome: [Window] Menu -> Extensions -> Load unpacked extension
- Firefox: [Tools] Menu -> Add-ons -> [Gear] Icon -> Debug Add-ons -> Load Temporary Add-on

#### Debug with Firefox XPI Package

To debug some behaviors such as Firefox restarts (for example, are context menus installed properly),
it is necessary to build an XPI package and install it on Firefox. Temporary Add-Ons won't be enough
because they get uninstalled after Firefox quits.

Firefox checks signature when installing XPI. To do so, 

1. Grab [API keys](https://addons.mozilla.org/en-US/developers/addon/api/key/) from Firefox Add-On
2. Bump version in `manifest.json` and use something like `2.3.4b1` or `2.3.4rc1`
3. Run:
    ```shell
    web-ext sign --channel=unlisted --api-key=... --api-secret=...
    ```

It'll create an XPI that is signed with your Firefox Add-Ons account. The file will also be
uploaded to Add-On Developer Hub as unlisted.

Note that Firefox Add-On keeps track of all the versions that has ever been uploaded, including
'self-distributed' (`channel=unlisted`). That's why using a `b1` or `rc1` suffix is preferred.

See https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/

### Tests

Unit tests are written in mocha, `./test/**/*.test.js`.

To run, use `npm test`.

### QA

There is a [qa.html](./test/qa.html) that includes various edge test cases. Open it in the browser, then try Copy as Markdown with the content in it.

## License

See [MIT-LICENSE.txt](./MIT-LICENSE.txt)
