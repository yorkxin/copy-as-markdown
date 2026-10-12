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

One image contains Firefox Stable, Firefox ESR and CfT Stable. The default runs
both Stable browsers in one session. `PROFILE=esr` selects Mozilla's current
primary ESR instead.

CI runs Firefox, Chromium and Firefox ESR using official Selenium images,
installing test utilities with APT. It reuses test extensions from the build job.
Stable browsers use the versions shipped in those images, which may lag Stable.
The local commands above retain the shared image and CfT version selection.
CI pins the ESR major with `FIREFOX_ESR_MAJOR` in the workflow and installs that
branch's latest patch via APT, falling back to a Mozilla archive if unavailable.

To run a subset of test cases, pass pytest arguments after `--`:

```sh
BROWSER=firefox npm run test:e2e:selenium:docker -- -k test_current_tab
```

## Version checking

The selected profile's installed majors must match their current channels:
Stable for `latest`, ESR for `esr`. If they differ, refresh the shared image:

```sh
npm run test:e2e:selenium:build-image
```

Older patches within the same major are accepted. If metadata is unavailable,
local runs reuse an existing image with a warning. Creating or updating an image
requires network access. This check applies to the local shared image; CI does
not perform a remote freshness check.

## Results

The terminal shows browser versions, test results and skip reasons. Reports are
saved in `test-results/selenium-<profile>-<browser>/` (`browser` is `all`,
`firefox`, `cft` or CI's `chromium`), replacing the previous run there.

Read `junit.xml` for test results, `run.log` for test failures and `build.log`
for image-build failures. `browser.log` and `environment.log` record the tested
versions and environment.
