# Copy as Markdown for Chrome & Firefox

Do you often type Markdown code manually for a link or image, or even all tabs in a window, and feel tired? **Copy as Markdown** can help you!

## Download

- <del>Google Chrome: [Chrome Web Store - Copy as Markdown](https://chrome.google.com/webstore/detail/copy-as-markdown/fkeaekngjflipcockcnpobkpbbfbhmdn?hl=en)</del> Currently Taken Down. See [this issue](https://github.com/chitsaou/copy-as-markdown/issues/84)
- Firefox: [Copy as Markdown :: Add-ons for Firefox](https://addons.mozilla.org/en-us/firefox/addon/copy-as-markdown/)

### Workaround to install the extension on Chrome

- Download the latest zip file from [releases](https://github.com/chitsaou/copy-as-markdown/releases);
- Unzip the file;
- Open the Extensions page (menu _Window / Extensions_, or go to `chrome://extensions/`);
- Check the option _"Developer mode"_ on the top right;
- Click on the _"Load unpacked"_ button on the top left;
- Choose the `src` directory from the extracted contents of the `.zip` file above.

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

- [Chrome] When copying an image, the image code does not include the alternative text of that image. This is due to API restriction.

## Development

### Install dependencies

```
npm install
```

### Debugging

The source code and manifest file is under `src/` folder.

To debug in Chrome: [Window] Menu -> Extensions -> Load unpacked extension

To debug in Firefox: [Tools] Menu -> Add-ons -> [Gear] Icon -> Debug Add-ons -> Load Temporary Add-on

TODO: Unit Tests

## License

See [MIT-LICENSE.txt](./MIT-LICENSE.txt)
