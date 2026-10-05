# Selenium browser tests

These tests cover Firefox extension pages and Firefox / Chrome for Testing
keyboard and context-menu flows. Run them in Docker to keep clipboard operations
inside the container. You need Docker and Python 3 on the host.

Agents: read [AGENTS.md](AGENTS.md) before working on these tests.

## Running tests

From the repository root:

```sh
npm run test:e2e:selenium:docker # both browsers, latest profile
PROFILE=minimum npm run test:e2e:selenium:docker
BROWSER=firefox npm run test:e2e:selenium:docker
BROWSER=cft npm run test:e2e:selenium:docker
```

The default runs both browsers in one session. `latest` uses the Stable versions
installed when the image was built; `minimum` uses Firefox 139.0 and CfT
116.

The `minimum` profile requires an AMD64 Linux host. When running on an ARM64 host 
(e.g. macOS); use the `latest` profile.

To run a subset of test cases, pass pytest arguments after `--`:

```sh
BROWSER=firefox npm run test:e2e:selenium:docker -- -k test_current_tab
```

## Stable version checking

When running the `latest` profile, the test script checks wheter the installed
version still matches the latest stable version. If the installed version 
does not match the major version of the latest stable version, it would ask you 
to refresh the image by running:

```sh
npm run test:e2e:selenium:build-image
```

Only the major version number is considered. Older patches within the same major 
is accepted.

The version checking requires internet access. If version checking fails due to 
offline or server unavailability, the script reuses the existing image with a 
warning. 

Set `CI=true` to enforce the stable-version check.

## Results

The terminal shows browser versions, test results and skip reasons. Reports are
saved in `test-results/selenium-<profile>-<browser>/` (`browser` is `all`,
`firefox` or `cft`), replacing the previous run there.

Read `junit.xml` for test results, `run.log` for test failures and `build.log`
for image-build failures. `browser.log` and `environment.log` record the tested
versions and environment.
