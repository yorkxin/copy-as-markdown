# Design: Selenium Firefox-only e2e suite + CI integration

**Date:** 2026-06-21
**Branch:** fix-firefox-e2e-tests

## Background

The project has two e2e test suites:

- **Playwright** — Chrome only. Covers formatting, UI, permissions, and clipboard via mock + real-clipboard smoke tests. Works in Docker locally and in GitHub Actions CI.
- **Selenium** (Python/pytest in `e2e_test/`) — Originally tested both Chrome and Firefox. Currently broken; not wired into CI. Tests OS-level keyboard shortcuts (via pyautogui) and popup UI for the hot-path clipboard copy flows.

The Playwright Firefox path is confirmed blocked: the playwright-firefox branch documented three failed approaches (Enterprise Policies require a signed addon; playwright-webextext can't interact with extension pages; Firefox MV3 has the same limitation). That path is not viable without upstream changes to Playwright's Firefox support.

The Selenium suite is the only viable path for automated Firefox e2e coverage.

## Goals

1. Scope the Selenium suite to **Firefox only** (Chrome is covered by Playwright).
2. Make the suite run **reliably headless** on Linux using `xvfb-run` (not `--headless`, which may not forward keyboard events to the extension).
3. Wire it into **GitHub Actions CI** as a native (non-Docker) job on `ubuntu-latest`.
4. Document local and CI usage in `DEVELOPMENT.md`.
5. Deferred (follow-up branch): wrap the proven native setup in a Docker image for local Mac parity, following the same pattern as `docker/playwright-ci/`.

## Design

### 1. Remove Chrome from the Selenium fixture

**File:** `e2e_test/conftest.py`

- Change `@pytest.fixture(params=["chrome","firefox"], ...)` → `params=["firefox"]`
- Delete the Chrome branch inside `browser_environment` (the `if browser == "chrome":` block and its teardown)
- Delete `_find_extension_id_for_chrome()` — Chrome shadow DOM scraping, unused without Chrome
- Delete `setup_keyboard_shortcuts_chrome()` from `BrowserEnvironment` — Chrome-only shortcut configuration
- Delete `os.environ['SE_FORCE_BROWSER_DOWNLOAD'] = 'true'` — only needed for Chrome for Testing download
- Keep the Firefox branch, `_find_extension_id_for_firefox()`, and `setup_keyboard_shortcuts_firefox()` unchanged

**File:** `requirements.txt`

- Remove `pyshadow` — only used by Chrome's shadow DOM navigation on `chrome://extensions/`
- Keep: `selenium`, `pytest`, `pyautogui`, `pyperclip`

### 2. Running mechanism: xvfb-run, not --headless

Firefox `--headless` is **not** used. Extension `commands` API keyboard shortcuts may not fire without a real display context. Instead, `xvfb-run -a` provides a virtual X11 display; pyautogui sends X11 key events; Firefox (running inside Xvfb) receives them as real keyboard events. This matches the pattern the Playwright Docker harness already uses.

`pyperclip` reads the clipboard via `xsel`, which must be installed.

**File:** `package.json` — add scripts:

```json
"test:e2e:selenium": "npm run test:e2e:build && xvfb-run -a pytest e2e_test/ -v"
```

Local usage on Linux (or inside Docker later):
```sh
npm run test:e2e:selenium
```

### 3. CI job in GitHub Actions

**File:** `.github/workflows/nodejs.yml` — add a `selenium` job:

```yaml
selenium:
  runs-on: ubuntu-latest
  needs: build
  timeout-minutes: 15
  steps:
    - uses: actions/checkout@v6
    - name: Use Node.js
      uses: actions/setup-node@v5
      with:
        node-version-file: ".node-version"
        cache: npm
    - run: npm ci
    - name: Install system dependencies
      run: sudo apt-get update && sudo apt-get install -y firefox xvfb xsel python3-pip
    - name: Install Python dependencies
      run: pip install -r requirements.txt
    - name: Build test extensions
      run: npm run test:e2e:build
    - name: Run Selenium Firefox e2e tests
      run: xvfb-run -a pytest e2e_test/ -v
```

### 4. Documentation

**File:** `DEVELOPMENT.md` — replace the "Firefox e2e tests — currently broken" section with:

- Description of the Firefox-only Selenium suite
- Local run command: `npm run test:e2e:selenium` (Linux) or note for Mac that Docker wrap is coming
- CI: runs in the `selenium` GitHub Actions job
- Requirements: Firefox, xvfb, xsel, Python 3.11+, `pip install -r requirements.txt`

**File:** `e2e_test/README.md` — update to reflect Firefox-only scope and xvfb-run usage.

## What stays the same

- The test files (`test_current_tab.py`, `test_tabs_exporting.py`) are unchanged.
- `helper_extension/` is unchanged.
- `keyboard_shortcuts.py` is unchanged.
- `helpers.py` (pyperclip wrapper) is unchanged.
- The fixture server (`FixtureServer`) is unchanged.
- `set_mock_clipboard_mode(False)` call in the fixture remains — ensures the extension uses the real clipboard path for the real-clipboard Selenium tests.

## Deferred

Docker wrapping (Option A from the design discussion) is a follow-up. Once the CI job is confirmed green, a `docker/selenium-ci/` directory will be added with a Dockerfile (extending the Playwright base image + Python layer) and `docker-e2e.sh`, adding `test:e2e:selenium:docker` for Mac local parity.
