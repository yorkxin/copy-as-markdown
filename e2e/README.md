# Copy as Markdown E2E Test

This folder contains E2E test cases of Copy as Markdown extension.

It uses [Selenium](https://www.selenium.dev/) and [java.awt.Robot](https://docs.oracle.com/javase%2F7%2Fdocs%2Fapi%2F%2F/java/awt/Robot.html) to automate the browsers and assert the contents of the clipboard.

## System Requirements

* Java
* Maven
* Google Chrome
* Firefox

## Development

* [JetBrains Aqua](https://www.jetbrains.com/aqua/)

## Install

```shell
./mvnw dependency:resolve
```

## Setup

### macOS Accessibility Warnings

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

- Right-click on `testng.xml` and choose "Run Tests". 
- To run test cases for a particular browser, select `testng-<browser>.xml`.

## Architecture

* `src/test` contains all the test scripts.
* `support/e2e-test-extension*` are Web Extensions used to control tabs in ways that Selenium can't do, 
  such as tab grouping, tab highlighting etc.
* `support/pages` contains static fixture pages used in test cases. When test suite starts, it will run a static server
  listening at `localhost:5566`. The E2E Test Extension will open those pages.

## TODO

* Test Edge
* Test on Linux & Windows