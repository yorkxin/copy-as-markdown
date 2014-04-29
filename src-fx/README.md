# Copy as Markdown (Firefox)

This is Copy as Markdown for Firefox.

## Requirements

* Firefox 29+

## Build Instruction

1. Install Firefox 29+. Currently available from Beta channel.
* [Install Firefox Add-ON SDK](https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Installation) if you haven't installed it.
* Run `cfx run` from Terminal

## Implemented Features

* Copy all tabs of current window as a Markdown list.
* Right click on anywhere of a page and copy the page title with URL as Markdown.
* Right click on a link and copy it as Markdown.
* Right click on an image and copy it as Markdown.

## TODO

* When copying an Image, if it is wrapped by a link, then the copied Markdown should also include that link.
* Context Menu Icon.
* Dynamic context menu item titles.

## Unable to Implement

* A dropdown menu when clicking the Copy as Markdown browser button, like Chrome version.
  * Requires [ui/button/toggle](https://developer.mozilla.org/en-US/Add-ons/SDK/Low-Level_APIs/ui_button_toggle#Attaching_panels_to_buttons) API, available from Firefox 30

## License

(The MIT License. Same as the chrome version.)

Copyright (c) 2014 Yu-Cheng Chuang

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
