# CLAUDE.md

This file guides Claude Code (and other agents) working in this repository.

**Read [DEVELOPMENT.md](DEVELOPMENT.md) before doing any development work here.** It is the
canonical source of truth for building, type-checking, linting, and testing. Build internals
are documented in [docs/build.md](docs/build.md).

## Essentials

- **Build:** `npm run build` (both targets). See [docs/build.md](docs/build.md).
- **Type-check:** `npm run typecheck` — **Lint:** `npm run lint`
- **Unit/browser tests:** `npm test` (vitest; no clipboard, runs anywhere).
- **E2E:** `npm run test:e2e:docker`. The full e2e suite **must run in Docker** — the
  clipboard-smoke project uses the real system clipboard. Read results from
  `test-results/results.json`, not stdout. See
  [DEVELOPMENT.md → E2E tests](DEVELOPMENT.md#e2e-tests-playwright).

Run `npm run typecheck`, `npm run lint`, and `npm test` before considering a change complete.
