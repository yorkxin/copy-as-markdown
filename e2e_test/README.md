# Selenium browser tests

These tests cover Firefox extension pages and Firefox / Chrome for Testing
keyboard and context-menu flows. Run them in Docker to keep clipboard operations
inside the container. You need Docker and Python 3 on the host.

Agents: read [AGENTS.md](AGENTS.md) before working on these tests.

## Running tests

From the repository root:

```sh
npm run test:e2e:selenium:docker # both browsers, latest profile
PROFILE=esr npm run test:e2e:selenium:docker
BROWSER=firefox npm run test:e2e:selenium:docker
BROWSER=cft npm run test:e2e:selenium:docker
```

The default runs both browsers in one session. `latest` uses the Stable versions
installed when the image was built. `esr` runs Firefox only, using Mozilla's
current primary ESR channel. CI tests Firefox Stable, CfT Stable and Firefox ESR.

To run a subset of test cases, pass pytest arguments after `--`:

```sh
BROWSER=firefox npm run test:e2e:selenium:docker -- -k test_current_tab
```

## Version checking

The installed major must match its current channel: Stable for `latest`, ESR for
`esr`. If it differs, refresh the corresponding image:

```sh
npm run test:e2e:selenium:build-image
PROFILE=esr npm run test:e2e:selenium:build-image
```

Older patches within the same major are accepted. If metadata is unavailable,
local runs reuse an existing image with a warning. Creating or updating an image
requires network access. CI requires the channel check to succeed.

## Results

The terminal shows browser versions, test results and skip reasons. Reports are
saved in `test-results/selenium-<profile>-<browser>/` (`browser` is `all`,
`firefox` or `cft`), replacing the previous run there.

Read `junit.xml` for test results, `run.log` for test failures and `build.log`
for image-build failures. `browser.log` and `environment.log` record the tested
versions and environment.
