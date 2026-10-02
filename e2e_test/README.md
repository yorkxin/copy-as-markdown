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
BROWSER=firefox npm run test:e2e:selenium:docker
BROWSER=cft npm run test:e2e:selenium:docker
PROFILE=minimum npm run test:e2e:selenium:docker
```

`BROWSER=all` is equivalent to the default. `PROFILE` selects:

| Profile | Browser versions | Stable check |
| --- | --- | --- |
| `latest` (default) | Stable releases resolved when the environment is first built or explicitly refreshed | Both installed majors must equal current official Stable majors |
| `minimum` | Firefox 139.0 + CfT 116.0.5845.96 | None; versions stay fixed |

The latest profile checks both installed majors against current official Stable
majors. A confirmed mismatch stops the run and asks you to refresh the image.
Older patches within the same major are accepted. If metadata is unavailable,
local runs warn and reuse an existing environment, recording the check as
unverified; CI (`CI=true` or `CI=1`) stops instead. Without a local environment,
initial image creation still requires network access.

Refresh browser versions separately from running tests:

```sh
npm run test:e2e:selenium:build-image
PROFILE=minimum npm run test:e2e:selenium:build-image
```

Extra arguments are forwarded to pytest. No matched tests remains a failure
(exit 5). Tests continue after ordinary test or collection failures; cancellation
stops the session. For a subset:

```sh
BROWSER=firefox npm run test:e2e:selenium:docker -- -k test_current_tab
BROWSER=cft npm run test:e2e:selenium:docker -- -k test_context_menu_copy_link
```

## Reusable environment images

The environment contains dependencies and both browsers. A separate lightweight
runner image adds the current checkout; extension builds run once per session.
Browser download stages are independent, and unchanged environment layers use
Docker's build cache. The current implementation builds environments locally;
GHCR publication and scheduled refreshes are deferred.

Tests reuse the existing profile image directly; only the lightweight runner
is built from the current checkout. This avoids browser metadata downloads and
environment rebuilds beyond the latest profile's best-effort Stable check.
Offline use requires the environment and runner build layers to be available
locally.

Advanced `FIREFOX_VERSION` / `CFT_VERSION` requests (`latest`, major or exact)
are accepted only by the image build command and produce a custom image. The
normal test entry supports only minimum/latest; it rejects old flags and version
overrides rather than silently ignoring them. GHCR image selection will be managed
by the harness when publication is added.

## Architecture

The harness uses the Docker server's architecture. Firefox and current CfT
releases support Linux AMD64 and ARM64; the fixed CfT 116 release supports only
AMD64. An unavailable browser/driver platform fails the run.

To run CfT 116 on an ARM host with AMD64 emulation available:

```sh
DOCKER_DEFAULT_PLATFORM=linux/amd64 PROFILE=minimum npm run test:e2e:selenium:docker
```

## Reading results

Each run writes to `test-results/selenium-<profile>-<selector>/` and replaces the
previous report there. One JUnit report covers all selected tests:

| File | Use |
| --- | --- |
| `junit.xml` | Authoritative pass, failure and skip results |
| `browser.log`, `environment.log` | Confirm tested versions, architecture, environment image ID and available registry digests |
| `run.log`, `build.log` | Diagnose test/startup or image-build failures |
| `metadata.json` | Find the environment profile, versions and Stable-check status/reason |

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
