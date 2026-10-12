# Selenium browser tests

These tests exercise extension pages, keyboard shortcuts and context menus using
real browsers and clipboard input inside Docker. Install Docker and the project's
Node dependencies first. Agents: read [AGENTS.md](AGENTS.md).

## Running tests

From the repository root:

```sh
npm run test:e2e:selenium:docker # Firefox, then Chromium
BROWSER=firefox npm run test:e2e:selenium:docker
BROWSER=chromium npm run test:e2e:selenium:docker
PROFILE=esr npm run test:e2e:selenium:docker # Firefox ESR 140
```

Local runs and CI use the official Selenium Firefox / Chromium images. Each
browser has its own container and test session. Stable versions come from the
images; use `docker pull selenium/standalone-firefox:latest` and
`docker pull selenium/standalone-chromium:latest` to refresh local images.
Each run needs network access to install test utilities.

CI selects the ESR major with `FIREFOX_ESR_MAJOR` in the workflow. Local ESR runs
default to 140; set the same variable to test another active ESR branch. Its latest
patch is downloaded from Mozilla’s archive.

Pass pytest arguments after `--` to select tests:

```sh
BROWSER=firefox npm run test:e2e:selenium:docker -- -k test_current_tab
```

## Results

The terminal shows actual browser versions and results for each session. Reports
replace the previous run in `test-results/selenium-<profile>-<browser>/`.
Read `junit.xml` for results, `run.log` for failures and actual browser session versions, and
`environment.log` for the installed versions. If either session fails, the command
exits with a failure status after running both browsers.
