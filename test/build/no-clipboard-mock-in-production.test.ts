import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const chromeDist = path.join(root, 'chrome', 'dist');
const firefoxDist = path.join(root, 'firefox-mv3', 'dist');

// Strings that appear ONLY in e2e builds. The build never minifies identifiers, so leaked
// e2e code would keep these verbatim in the production bundle.
const SENTINELS = ['mockClipboardCalls', '__mockClipboardService', 'createMockClipboardService', '__listenersReady'];

// .js ONLY — never .js.map: the sourcemap embeds the full original clipboard-service.ts
// (including the tree-shaken mock) via sourcesContent, which would false-positive.
function jsFiles(distDir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(distDir)) {
    const p = path.join(distDir, name);
    if (name.endsWith('.js')) {
      out.push(p);
    } else if (name === 'ui') {
      for (const u of readdirSync(p)) {
        if (u.endsWith('.js')) out.push(path.join(p, u));
      }
    }
  }
  return out;
}

describe('production bundles exclude the clipboard mock', () => {
  beforeAll(() => {
    // Production builds (esbuild define BUILD_PROFILE='production') in a child process —
    // independent of vitest's 'e2e' define for this test file.
    execSync('node scripts/build.js chrome', { cwd: root, stdio: 'inherit' });
    execSync('node scripts/build.js firefox-mv3', { cwd: root, stdio: 'inherit' });
  }, 180_000);

  for (const [label, dist] of [['chrome', chromeDist], ['firefox-mv3', firefoxDist]] as const) {
    it(`has no clipboard-mock sentinel anywhere in ${label} JS`, () => {
      for (const f of jsFiles(dist)) {
        const src = readFileSync(f, 'utf8');
        for (const sentinel of SENTINELS) {
          expect(src, `${f} contains "${sentinel}"`).not.toContain(sentinel);
        }
      }
    });
  }
});
