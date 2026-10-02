# Selenium browser e2e suites

Selenium drives Firefox extension pages and real keyboard/context-menu clipboard
flows. Tests use the system clipboard, so run them in Docker.

## Coverage

| Suite | Coverage |
| --- | --- |
| Firefox | Single-tab and multi-tab copy, popup UI, selection conversion and native context menus |
| Chrome for Testing (CfT) | Three smoke tests: keyboard copy of the current tab, context-menu copy of a link and an image |

The default command runs both browsers in separate containers, one after the
other. Tests within each suite are serial. CI explicitly selects Firefox
139.0/latest and CfT 116.0.5845.96/latest as four separate jobs.

## Running

Host requirements: Docker, curl and Python 3. Test dependencies are installed in
the image.

```sh
npm run test:e2e:selenium:docker # both browsers, latest stable
SELENIUM_BROWSER=firefox npm run test:e2e:selenium:docker # Firefox only
SELENIUM_BROWSER=cft npm run test:e2e:selenium:docker     # CfT only
```

`SELENIUM_BROWSER=all` is equivalent to the default. Each version defaults to
`latest`; `FIREFOX_VERSION` and `CFT_VERSION` accept a major or an exact version:

```sh
SELENIUM_BROWSER=firefox FIREFOX_VERSION=139 npm run test:e2e:selenium:docker
SELENIUM_BROWSER=cft CFT_VERSION=116 npm run test:e2e:selenium:docker
```

A major selects its latest ordinary Firefox release or latest downloadable CfT
milestone version. CfT major selection may include a pre-release milestone;
`latest` always selects Stable. Firefox major selection excludes ESR and
pre-releases. Version settings do not select a browser: `FIREFOX_VERSION=139`
without a selector still runs CfT latest too. No Firefox minor-range selector is
provided; dotted Firefox versions mean exact releases.

Use an exact version to reproduce a run or test the minimum supported version:

```sh
SELENIUM_BROWSER=firefox FIREFOX_VERSION=139.0 npm run test:e2e:selenium:docker
SELENIUM_BROWSER=cft CFT_VERSION=116.0.5845.96 npm run test:e2e:selenium:docker
```

Resolution, test start, live session and result output identify the browser and
complete version. The original version request is also recorded in the reports.
CfT 116 tests the minimum supported milestone; the selected patch is
116.0.5845.96. The Chrome suite uses CfT, which supports loading the unpacked test
extension, rather than ordinary branded Google Chrome.

All mode runs the second browser even if the first fails, then summarizes both;
any failed job makes the command fail. Interruption stops further suites.
Extra arguments are forwarded to pytest. Select a browser when running a subset;
no matched tests remains a failure (pytest exit 5):

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
| `metadata.json` | Find the resolved release and download URLs |

The command exits with the build/test failure status. CI uploads reports even
when tests fail. Pytest prints existing skip reasons with the results.

## Maintaining the harness

[The Docker harness](../docker/selenium-ci/docker-e2e.sh) and
[browser fixtures](conftest.py) contain installation, version-check and native
input details. When changing CfT metadata selection, run its offline checks:

```sh
python3 -m unittest discover -s docker/selenium-ci -p 'test_*.py'
```
