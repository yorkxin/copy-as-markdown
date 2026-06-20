import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Build both extension targets ONCE before the whole suite runs.
//
// The build tests under test/build/ assert against chrome/dist and firefox-mv3/dist.
// scripts/build.js destructively cleans the target's dist (`rm -rf <target>/dist`) before
// rebuilding, so when each test rebuilt in its own parallel vitest worker they wiped each
// other's in-flight output — a race that is benign on fast native FS but reliably corrupts on
// slower bind-mounted (container) FS. Building once here, before any worker starts, removes both
// the race and the redundant repeat builds.
export default function setup(): void {
  execSync('node scripts/build.js chrome', { cwd: root, stdio: 'inherit' });
  execSync('node scripts/build.js firefox-mv3', { cwd: root, stdio: 'inherit' });
}
