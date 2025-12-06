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
  background.ts
  handlers/        # Message/command/context-menu handlers
  services/        # Browser-agnostic logic (+ browser adapters via createBrowser* helpers)
  ui/              # Popup/options scripts
chrome/            # Chrome / Chromium files
  dist/            # ../src will be copied here
  manifest.json
firefox-mv2/       # Firefox Manifest V2 files
  dist/            # ../src will be copied here
  manifest.json
  background.html  # Loads ESModule
firefox-mv3/       # Firefox Manifest V3 files
  dist/            # ../src will be copied here
  manifest.json
test/
  e2e/             # Playwright E2E Tests
  ...              # Unit Tests
e2e_test/          # Python E2E Tests
```  

### Architecture overview

- Services contain pure logic (e.g., link/tab export, selection conversion) plus thin browser adapters created via `createBrowser*` helpers. Browser dependencies are injected for easier testing.
- Handlers orchestrate user entry points (context menu, keyboard commands, runtime messages) and delegate to services.
- UI scripts live under `src/ui` for popup/options pages; static assets under `src/static`.


### Install dependencies

```
npm install -g web-ext
npm install
```

## Debugging

Use the script `scripts/debug.js` that runs an auto-reload process. Usage:

```sh
npm debug-chrome
npm debug-firefox-mv2
npm debug-firefox-mv3
```

For manual debugging without auto-reload:

- Chrome: [Window] Menu -> Extensions -> Load unpacked extension
- Firefox: [Tools] Menu -> Add-ons -> [Gear] Icon -> Debug Add-ons -> Load Temporary Add-on

### Firefox Testing with XPI

To debug some behaviors such as Firefox restarts (for example, are context menus installed properly),
it is necessary to build an XPI package and install it on Firefox. Temporary Add-Ons won't be enough
because they get uninstalled after Firefox quits.

Firefox checks the signature when installing XPI, which cannot be disabled in the release build of Firefox.
Please use **Firefox Developer Edition, Nightly, or unbranded Beta** versions to sideload an unsigned XPI.
See *[Testing persistent and restart features (Extension Workshop)](https://extensionworkshop.com/documentation/develop/testing-persistent-and-restart-features/)* for more details.

1. `npm run build-firefox-mv3`. The XPI will be saved in `./build/firefox-mv3` folder.
2. In Firefox Developr Edition, go to `about:flags`, set `xpinstall.signatures.required` to `false`. Restart the browser
3. Go to `about:addons`, drag and drop th XPI file into this page to install.
4. Restart the browser to verify behaviors on restart.

### Signing XPI

If sideloading on the release build of Firefox is necessary,
here are the steps to sign the extesnion via AMO:

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

### Playwright E2E Tests

The extension UI and clipboard flows are covered with Playwright. Tests run Chromium in headed mode with a persistent profile, which is required for Chrome extensions.

```sh
# Builds the Chrome test extension and then runs the Playwright suite
npm run test:e2e
```

On Linux without a graphical session you can use Xvfb:

```sh
xvfb-run -a npm run test:e2e
```

#### Run in Docker (CI parity)

To mimic the GitHub Actions runner locally, use the provided Dockerfile which is based on the official Playwright image (already contains browsers, fonts, and necessary libraries):

```sh
npm run test:e2e:docker
```

For an interactive shell that shares your working tree for faster iteration:

```sh
docker run --rm -it --ipc=host -v "$(pwd)":/workspace copy-as-markdown-playwright bash
```

Both commands execute exactly what CI does (`npm run test:e2e`), so you can reproduce CI-only flaky failures locally.

### QA

There is a [qa.html](./fixtures/qa.html) that includes various edge test cases. Open it in the browser, then try Copy as Markdown with the content in it.

## License

See [MIT-LICENSE.txt](./MIT-LICENSE.txt)
