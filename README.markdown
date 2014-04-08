# Copy as Markdown (Chrome Extension)

People love Markdown.  But we often type Markdown code manually for a link or image, or even all tabs in a window. **Y U NO** let the browser do the dirty things?

That's why I made **Copy as Markdown**.

## Features

**Copy as Markdown** is a Chrome extension which can help you copy the following things as Markdown to your system clipboard:

### Current Tab as Link

Through the Right-Top **"md"** button, or a Right-Clicking on the empty area of the page.

Supports both `[page title](url)` and `[page title][id]` following its `[id]: url`.

### A Link on the Page

Through Right-Clickubg on a link.

Supports both `[text](url)` and `[text][id]` following its `[id]: url` 

**Pro-Tip**: If the link has an Image in it, the copied Markdown will take that image as link text.

### An Image on the Page

Through Right-Clickubg on an image.

The copied Markdown code will be `![](url)`.

*Note*: It is known issue that I don't understand how to get the `img.alt`.

### All Tabs as a List of Links (!)

Through the Right-Top **"md"** button.

The copied Markdown code will be:

    * [title of tab1](url of tab1)
    * [title of tab2](url of tab2)
    * [title of tab3](url of tab3)
    * ...

*Note*: Planning to provide a reference-style option.

## Keyboard Shortcuts

You can add keyboard shortuts for copying tab(s) as Markdown. By default, Copy as Markdown does not assign any keyboard shortcuts.

1. Open [Extensions Page at chrome://extensions/](chrome://extensions/).
2. Scroll to the bottom and click "Keyboard shortcuts"
![](screenshots/keybinding-1.png)
3. Assign Keyboard Shortcuts in the dialog.

![](screenshots/keybinding-2.png)

## Known Issues

- Cannot grab `image.alt`
- (more issues in the issue tracker)

## Contributing

Coding ninja?  You can help this project by:

- adding features,
- fixing bugs,
- UI improvement (CSS), or
- converting it to CoffeeScript

*Note:* I want the product be lightweight; please avoid using any 3rd-party library such as jQuery or CSS framework.

## The MIT License

Copyright (c) 2012 Yu-Cheng Chuang

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
