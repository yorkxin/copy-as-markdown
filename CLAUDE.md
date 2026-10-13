# CLAUDE.md

This file guides Claude Code (and other agents) working in this repository.

**Read [DEVELOPMENT.md](DEVELOPMENT.md) before doing any development work here.** It is the
canonical source of truth for building, type-checking, linting, and testing. Build internals
are documented in [docs/build.md](docs/build.md).

## Work isolation

Before modifying code, documentation, tests, or configuration for a task, create a new branch
and a dedicated Git worktree for that task. Do all edits, builds, and tests from the dedicated
worktree; do not work directly in the primary checkout.

For example, from the primary checkout:

```sh
git worktree add -b <task-branch> .worktrees/<task-slug> HEAD
cd .worktrees/<task-slug>
```

Always place task worktrees under the primary checkout's `.worktrees/` directory so they remain
inside the repository workspace and its sandbox write boundary. Use a short, descriptive branch
and directory name. When the request includes a specific GitHub issue number, name the branch
`<feature|fix|chore>/issue-NNN-<summary>`, choosing the prefix that matches the type of work and
replacing `NNN` with the issue number. Before creating the worktree, inspect the current branch
and working-tree status. Do not move or copy unrelated uncommitted changes into the task
worktree. If the agent was already started inside a dedicated worktree and branch for the
current task, use it instead of creating another worktree.

## Essentials

- **Build:** `npm run build` (both targets). See [docs/build.md](docs/build.md).
- **Type-check:** `npm run typecheck` — **Lint:** `npm run lint`
- **Unit/browser tests:** `npm test` (vitest; no clipboard, runs anywhere).
- **E2E:** Always run e2e tests in Docker with `npm run test:e2e:docker`, whether running the
  full suite, a single test file, or even one individual test case. Never run an e2e test directly
  on the host. If Docker is not installed on the host, stop and ask the operator to install Docker,
  OrbStack, or Podman, then manually run `npm run test:e2e:docker` to confirm the environment is
  ready. The clipboard-smoke project uses the real system clipboard. Read results from
  `test-results/results.json`, not stdout. See
  [DEVELOPMENT.md → E2E tests](DEVELOPMENT.md#e2e-tests-playwright).

Run `npm run typecheck`, `npm run lint`, and `npm test` before considering a change complete.
