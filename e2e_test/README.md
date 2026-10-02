# Selenium browser e2e suites

Selenium drives Firefox extension pages and real keyboard/context-menu clipboard
flows. Tests use the system clipboard, so run them in Docker.

## Coverage

| Suite | Coverage |
| --- | --- |
| Firefox | Single-tab and multi-tab copy, popup UI, selection conversion and native context menus |
| Chrome for Testing (CfT) | Three smoke tests: keyboard copy of the current tab, context-menu copy of a link and an image |

The default command runs both browsers serially in one container and one pytest
session. The image always contains both browsers; selecting a browser only filters
its tests. CI retains four jobs: each browser with the minimum or latest profile.

## Running

Host requirements: Docker and Python 3. Dependencies are installed in the image.

```sh
npm run test:e2e:selenium:docker # both browsers, latest image profile
SELENIUM_BROWSER=firefox npm run test:e2e:selenium:docker
SELENIUM_BROWSER=cft npm run test:e2e:selenium:docker
SELENIUM_PROFILE=minimum npm run test:e2e:selenium:docker
```

`SELENIUM_BROWSER=all` is equivalent to the default. `SELENIUM_PROFILE` selects:

| Profile | Browser versions | Stable check |
| --- | --- | --- |
| `latest` (default) | Stable releases resolved when the environment is first built or explicitly refreshed | Both installed majors must equal current official Stable majors |
| `minimum` | Firefox 139.0 + CfT 116.0.5845.96 | None; versions stay fixed |
| `custom` | Explicit version requests; unspecified browser defaults to latest Stable | None |

The latest profile accepts older patches within the current major. A major mismatch
or inability to fetch current Stable metadata stops the run. Refresh the local
latest environment with:

```sh
SELENIUM_REBUILD=1 npm run test:e2e:selenium:docker
```

`FIREFOX_VERSION` and `CFT_VERSION` automatically select the custom profile, without
changing which browser tests run. Both accept `latest`, a major, or an exact version:

```sh
FIREFOX_VERSION=139 npm run test:e2e:selenium:docker # still tests both browsers
SELENIUM_BROWSER=cft CFT_VERSION=116 npm run test:e2e:selenium:docker
FIREFOX_VERSION=139.0 CFT_VERSION=116.0.5845.96 npm run test:e2e:selenium:docker
```

Firefox major selection excludes ESR and pre-releases; dotted versions are exact
releases, not minor ranges. CfT major selects the latest downloadable milestone,
which may be a pre-release; `latest` selects Stable. Version overrides cannot be
combined with an explicit minimum/latest profile.

Extra arguments are forwarded to pytest. No matched tests remains a failure
(exit 5). Tests continue after ordinary test or collection failures; cancellation
stops the session. For a subset:

```sh
SELENIUM_BROWSER=firefox npm run test:e2e:selenium:docker -- -k test_current_tab
SELENIUM_BROWSER=cft npm run test:e2e:selenium:docker -- -k test_context_menu_copy_link
```

## Reusable environment images

The environment contains dependencies and both browsers. A separate lightweight
runner image adds the current checkout; extension builds run once per session.
Browser download stages are independent, and unchanged environment layers use
Docker's build cache. The current implementation builds environments locally;
GHCR publication and scheduled refreshes are deferred.

`SELENIUM_IMAGE=<reference>` uses an existing environment instead of building it.
Use the matching `SELENIUM_PROFILE`; latest still checks both Stable majors,
minimum checks the exact fixed pair, and custom checks the requested pair. The
image must implement this harness's environment contract (both version variables,
binaries, dependencies, appuser and entrypoint). External images are pulled only
when absent locally; explicitly pull a moving tag to refresh it, or use a digest
for reproducibility. `SELENIUM_REBUILD` cannot refresh an external image.

## Architecture

The harness uses the Docker server's architecture. Firefox and current CfT
releases support Linux AMD64 and ARM64; the fixed CfT 116 release supports only
AMD64. An unavailable browser/driver platform fails the run.

To run CfT 116 on an ARM host with AMD64 emulation available:

```sh
DOCKER_DEFAULT_PLATFORM=linux/amd64 SELENIUM_PROFILE=minimum npm run test:e2e:selenium:docker
```

## Reading results

Each run writes to `test-results/selenium-<profile>-<selector>/` and replaces the
previous report there. One JUnit report covers all selected tests:

| File | Use |
| --- | --- |
| `junit.xml` | Authoritative pass, failure and skip results |
| `browser.log`, `environment.log` | Confirm tested versions, architecture, environment image ID and available registry digests |
| `run.log`, `build.log` | Diagnose test/startup or image-build failures |
| `metadata.json` | Find the environment profile, versions and resolution metadata |

The command exits with the build/test failure status. CI uploads reports even
when tests fail. Pytest labels each test with `[firefox]` or `[cft]`, prints live session versions
and summarizes each browser. Existing skip reasons remain visible.

## Maintaining the harness

[The Docker harness](../docker/selenium-ci/docker-e2e.sh) and
[browser fixtures](conftest.py) contain installation, version-check and native
input details. When changing CfT metadata selection, run its offline checks:

```sh
python3 -m unittest discover -s docker/selenium-ci -p 'test_*.py'
```
