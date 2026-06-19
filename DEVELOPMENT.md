# Development

Canonical instructions for developing, building, and testing **Copy as Markdown**.
This is the single source of truth — both humans and Claude Code should follow it for
any development work in this repository.

For the internals of the esbuild pipeline (entry points, the `BUILD_TARGET` flag, keeping
Turndown out of the Chrome service worker, source maps, adding entry points), see
[docs/build.md](docs/build.md).

## Prerequisites

- Node.js >= 20
- `npm install` (project dependencies)
- `npm install -g web-ext` (Firefox packaging / `web-ext run` debugging)
- Docker — required to run the full e2e suite (see [E2E tests](#e2e-tests-playwright))

## Project layout

The platform-specific folders exist to resolve browser inconsistencies. `src/` is the shared
source; `scripts/build.js` copies/bundles it into each target's `dist/`.

```
src/               # Shared source code
  background.ts    # MV3 service worker / Firefox event-page entry
  handlers/        # Message / command / context-menu handlers
  services/        # Browser-agnostic logic (+ browser adapters via createBrowser* helpers)
  ui/              # Popup / options scripts
  static/          # HTML pages and static assets (copied verbatim)
chrome/            # Chrome / Chromium target — manifest.json + dist/ (built)
firefox-mv3/       # Firefox MV3 target — manifest.json + dist/ (built)
test/
  e2e/             # Playwright e2e tests
  ui/, lib/        # vitest browser tests (real Chromium)
  **/*.test.ts     # vitest unit tests (node)
e2e_test/          # Python (pytest) e2e tests for Firefox — currently broken
docker/playwright-ci/  # Dockerized e2e harness (CI parity)
```

### Architecture overview

- **Services** contain pure logic (link/tab export, selection conversion) plus thin browser
  adapters created via `createBrowser*` helpers. Browser dependencies are injected for testing.
- **Handlers** orchestrate user entry points (context menu, keyboard commands, runtime messages)
  and delegate to services.
- **UI** scripts under `src/ui` drive the popup/options pages; static assets live in `src/static`.

## Build

`npm run build` builds both targets. See [docs/build.md](docs/build.md) for the full mechanism.

```sh
npm run build              # build chrome/ and firefox-mv3/
npm run build-chrome       # Chrome only (+ asserts Turndown is absent from the SW bundle)
npm run build-firefox-mv3  # Firefox only
npm run package            # build + zip / web-ext build store artifacts into build/
```

## Type-checking and linting

```sh
npm run typecheck   # tsc (type-check only; esbuild owns emit)
npm run lint        # eslint
npm run lint:fix    # eslint --fix
```

## Unit & browser tests (vitest)

Two vitest projects: `unit` (node, `test/**/*.test.ts`) and `browser` (real Chromium via
Playwright, `test/ui/**` and `test/lib/**`). These do **not** touch the system clipboard, so they
run anywhere without Docker.

```sh
npm test            # run all vitest projects once
npm run test:watch  # watch mode
npm run test:ui     # vitest UI
npm run test:unit    # unit project only
npm run test:browser # browser project only
```

## E2E tests (Playwright)

The extension UI and clipboard flows are covered with Playwright. Tests run Chromium in headed
mode with a persistent profile (required for Chrome extensions). The suite has two projects:

- **parallel-tests** — all non-clipboard e2e tests, fully parallel.
- **clipboard-smoke** — real system-clipboard tests, run serially (`workers: 1`).

> **The full suite must run in Docker.** The clipboard-smoke project reads and writes the **real
> system clipboard**, so running it directly on your machine hijacks your clipboard and is sensitive
> to focus/timing. Use Docker for the authoritative run; use the host commands below only for
> iterating on individual non-clipboard specs.

### In Docker (canonical / CI parity)

```sh
npm run test:e2e:docker
```

This runs [docker/playwright-ci/docker-e2e.sh](docker/playwright-ci/docker-e2e.sh), which:

1. Builds the image from [docker/playwright-ci/Dockerfile](docker/playwright-ci/Dockerfile)
   (official Playwright image; browsers, fonts, and libraries preinstalled).
2. Runs the suite under Xvfb with `CI=true`, mounting `test-results/` and `playwright-report/`
   back to the host. The container exits with the real test exit code (it does not hang serving
   the HTML report).
3. Prunes only the dangling image this project's previous build orphaned (scoped by a Dockerfile
   `LABEL`), so other projects' images are never touched.

With `CI=true`, Playwright retries failures (`retries: 2`) and writes machine-readable output. Read
the result from **`test-results/results.json`**, not from scrolling stdout. The HTML report lands in
`playwright-report/`.

#### Reading a failed run

The container exits as soon as the suite finishes (it does **not** stay up serving the report). All
artifacts are bind-mounted to the host, so you read them locally after the run:

```sh
npx playwright show-report   # opens playwright-report/ on a local server + trace viewer
```

This is the same HTML report you'd get inside the container, but served by your **host** Playwright
against the mounted `playwright-report/` directory — useful for digging into a failure visually.

On failure the config captures a screenshot (`only-on-failure`), a video (`retain-on-failure`), and
a trace (`on-first-retry`); these land under `test-results/<test-name>/` and are linked from the HTML
report. For a quick, scriptable summary of what failed, parse `test-results/results.json` directly
(e.g. `jq '.suites[].specs[] | select(.ok==false)' test-results/results.json`).

For an interactive shell that shares your working tree (faster iteration, manual reruns inside the
container):

```sh
docker run --rm -it --ipc=host -v "$(pwd)":/workspace copy-as-markdown-playwright bash
```

### On the host (non-clipboard specs only)

```sh
npm run test:e2e          # build test extensions, then run Playwright
npm run test:e2e:headed   # headed
npm run test:e2e:ui       # Playwright UI mode
npm run test:e2e:debug    # Playwright inspector
```

On Linux without a graphical session, wrap with Xvfb:

```sh
xvfb-run -a npm run test:e2e
```

`npm run test:e2e` first runs `npm run test:e2e:build` (`npm run build` +
`node scripts/build-test-extension.js`), which produces the test extension as a copy of the
production build with manifest permissions rewritten for testing.

### Firefox e2e tests (Python / pytest) — currently broken

[e2e_test/](e2e_test/) holds a separate pytest-based e2e suite that drives **Firefox** (the
Playwright suite above covers Chrome). It is **currently broken and not maintained** — pending a
fix when time allows. See [e2e_test/README.md](e2e_test/README.md). Don't rely on it for
verifying changes yet; use the Playwright suite for e2e coverage in the meantime.

## Debugging the extension

Auto-reload via esbuild `--watch` + `web-ext run`:

```sh
npm run debug-chrome
npm run debug-firefox-mv3
```

Manual loading without auto-reload:

- **Chrome:** Extensions → Load unpacked extension → select `chrome/`.
- **Firefox:** Tools → Add-ons → gear icon → Debug Add-ons → Load Temporary Add-on.

### Firefox testing with XPI

Temporary Add-ons are uninstalled when Firefox quits, so to test restart behaviors (e.g. whether
context menus reinstall) you must build and sideload an XPI. Firefox checks XPI signatures and this
can't be disabled in release Firefox — use **Developer Edition, Nightly, or unbranded Beta**.
See [Testing persistent and restart features](https://extensionworkshop.com/documentation/develop/testing-persistent-and-restart-features/).

1. `npm run package-firefox-mv3` — the XPI is saved in `./build/firefox-mv3`.
2. In Firefox Developer Edition, open `about:config`, set `xpinstall.signatures.required` to
   `false`, and restart.
3. Open `about:addons` and drag-and-drop the XPI onto the page to install.
4. Restart the browser to verify restart behaviors.

### Signing XPI

To sideload on release Firefox, sign via AMO:

1. Grab [API keys](https://addons.mozilla.org/en-US/developers/addon/api/key/) from Firefox Add-ons.
2. Bump the version in `manifest.json` (AMO requires `X.Y.Z`, all numeric, no zero-prefixes).
3. Run:

   ```sh
   web-ext sign --channel=unlisted --api-key=... --api-secret=...
   ```

This creates an XPI signed with your AMO account and uploads it as unlisted. AMO permanently tracks
every uploaded version, including self-distributed (`channel=unlisted`) ones.
See <https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/>.

## Manual QA

[fixtures/qa.html](fixtures/qa.html) collects various edge cases. Open it in the browser and exercise
Copy as Markdown against the content.
