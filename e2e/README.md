# Copy as Markdown E2E Test

This folder contains E2E test cases of Copy as Markdown extension.

It uses [Selenium](https://www.selenium.dev/) to automate the browsers and assert the contents of the clipboard.

## System Requirements

* Java
* Maven
* Google Chrome

## Development

* [JetBrains Aqua](https://www.jetbrains.com/aqua/)

## Install

```shell
./mvnw dependency:resolve
```

## Setup

### macOS Assistive Control

When you first run the test cases in the terminal, you will be prompted about
the permissions of Assistive Control. 
Go to **Settings / Privacy and Security / Accessibility** and enable the terminal
app you are using. See [Apple's help page](https://support.apple.com/en-gb/guide/mac-help/mchl211c911f/mac) for more details.

## Run Tests

Please hold back and don't touch mouse / keyboard while the tests are running.

### Terminal

```shell
./mvnw clean test
```

### JetBrains Aqua

Just right-click on the test folder and choose "Run Tests". 

## Architecture

* `src/test` contains all the test scripts.
* `support/e2e-test-extension` is a Web Extension used to control tabs in ways that Selenium can't do, 
  such as tab grouping, tab highlighting etc.
* `support/pages` contains static fixture pages used in test cases. When test suite starts, it will run a static server
  listening at `localhost:5566`. The E2E Test Extension will open those pages.

## TODO

* Test on Firefox
* Test on Linux