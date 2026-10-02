# Selenium browser e2e suites

Selenium drives Firefox extension pages and real keyboard/context-menu clipboard
flows. Tests use the system clipboard, so run them in Docker.

## Coverage

| Suite | Coverage |
| --- | --- |
| Firefox | Single-tab and multi-tab copy, popup UI, selection conversion and native context menus |
| Chrome for Testing (CfT) | Three smoke tests: keyboard copy of the current tab, context-menu copy of a link and an image |

The current selector runs one browser per invocation. Tests within each suite are
serial. CI runs Firefox 139.0/latest and CfT 116.0.5845.96/latest as four separate jobs.

## Running

Host requirements: Docker, curl and Python 3. Test dependencies are installed in
the image.

```sh
npm run test:e2e:selenium:docker # currently Firefox 139.0 only
SELENIUM_BROWSER=firefox FIREFOX_VERSION=latest npm run test:e2e:selenium:docker
SELENIUM_BROWSER=cft CFT_VERSION=latest npm run test:e2e:selenium:docker
```

Use an exact version to reproduce a run or test the minimum supported version:

```sh
SELENIUM_BROWSER=firefox FIREFOX_VERSION=139.0 npm run test:e2e:selenium:docker
SELENIUM_BROWSER=cft CFT_VERSION=116.0.5845.96 npm run test:e2e:selenium:docker
```

`latest` means the official stable release; the resolved version is recorded in
the reports. CfT 116 tests the minimum supported milestone; the selected patch is
116.0.5845.96. The Chrome suite uses CfT, which supports loading the unpacked test
extension, rather than ordinary branded Google Chrome.

Extra arguments are forwarded to pytest. Select a browser when running a subset:

```sh
SELENIUM_BROWSER=firefox FIREFOX_VERSION=latest npm run test:e2e:selenium:docker -- -k test_current_tab
SELENIUM_BROWSER=cft CFT_VERSION=latest npm run test:e2e:selenium:docker -- -k test_context_menu_copy_link
```

## Architecture

The harness uses the Docker server's architecture. Firefox and current CfT
releases support Linux AMD64 and ARM64; the fixed CfT 116 release supports only
AMD64. An unavailable browser/driver platform fails the run.

To run CfT 116 on an ARM host with AMD64 emulation available:

```sh
DOCKER_DEFAULT_PLATFORM=linux/amd64 SELENIUM_BROWSER=cft CFT_VERSION=116.0.5845.96 npm run test:e2e:selenium:docker
```

## Reading results

Each run writes to `test-results/selenium-<browser>-<exact-version>/`:

| File | Use |
| --- | --- |
| `junit.xml` | Authoritative pass, failure and skip results |
| `browser.log`, `environment.log` | Confirm tested versions, architecture and image ID |
| `run.log`, `build.log` | Diagnose test/startup or image-build failures |
| `metadata.json` (when resolved) | Find the resolved release and download URLs |

The command exits with the build/test failure status. CI uploads reports even
when tests fail. Pytest prints existing skip reasons with the results.

## Maintaining the harness

[The Docker harness](../docker/selenium-ci/docker-e2e.sh) and
[browser fixtures](conftest.py) contain installation, version-check and native
input details. When changing CfT metadata selection, run its offline checks:

```sh
python3 -m unittest discover -s docker/selenium-ci -p 'test_*.py'
```
