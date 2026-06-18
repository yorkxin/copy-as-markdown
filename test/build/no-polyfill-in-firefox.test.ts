import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const firefoxDist = path.join(root, 'firefox-mv3', 'dist');
const chromeDist = path.join(root, 'chrome', 'dist');

// `wrapAPIs` is internal to webextension-polyfill — present iff polyfill code is in a file.
const POLYFILL_MARKER = /wrapAPIs/;
// The external side-effect import emitted into each Chrome entry bundle.
const EXTERNAL_IMPORT = '/vendor/browser-polyfill.js';

const UI_ENTRIES = [
  'popup', 'options', 'options-permissions', 'permissions',
  'custom-format', 'check-custom-formats', 'built-in-style-options',
];

function htmlFiles(staticDir: string): string[] {
  return readdirSync(staticDir).filter((n) => n.endsWith('.html')).map((n) => path.join(staticDir, n));
}
function jsFiles(distDir: string): string[] {
  // background.js + ui/*.js (+ offscreen.js on chrome); recurse one level.
  const out: string[] = [];
  for (const name of readdirSync(distDir)) {
    const p = path.join(distDir, name);
    if (name.endsWith('.js')) out.push(p);
    else if (name === 'ui') for (const u of readdirSync(p)) if (u.endsWith('.js')) out.push(path.join(p, u));
  }
  return out;
}

describe('webextension-polyfill ships to chrome only', () => {
  beforeAll(() => {
    execSync('node scripts/build.js firefox-mv3', { cwd: root, stdio: 'inherit' });
    execSync('node scripts/build.js chrome', { cwd: root, stdio: 'inherit' });
  }, 180_000);

  // --- Firefox: fully absent ---
  it('does not ship browser-polyfill.js to firefox vendor', () => {
    expect(existsSync(path.join(firefoxDist, 'vendor', 'browser-polyfill.js'))).toBe(false);
    expect(existsSync(path.join(firefoxDist, 'vendor', 'bulma.css'))).toBe(true);
  });
  it('has no polyfill code or external import anywhere in firefox JS', () => {
    for (const f of jsFiles(firefoxDist)) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(POLYFILL_MARKER);
      expect(src, f).not.toContain(EXTERNAL_IMPORT);
    }
  });
  it('has no polyfill <script> in any firefox HTML', () => {
    // Match the src path, not the bare filename: about.html mentions it in attribution.
    for (const f of htmlFiles(path.join(firefoxDist, 'static'))) {
      expect(readFileSync(f, 'utf8'), f).not.toContain('vendor/browser-polyfill.js');
    }
  });

  // --- Chrome: one shared external file, never inlined ---
  it('ships browser-polyfill.js to chrome vendor with polyfill code', () => {
    const vendor = path.join(chromeDist, 'vendor', 'browser-polyfill.js');
    expect(existsSync(vendor)).toBe(true);
    expect(readFileSync(vendor, 'utf8')).toMatch(POLYFILL_MARKER);
  });
  it('does not inline polyfill code into any chrome bundle', () => {
    for (const f of jsFiles(chromeDist)) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(POLYFILL_MARKER);
    }
  });
  it('emits the external import in the SW and every UI entry bundle', () => {
    expect(readFileSync(path.join(chromeDist, 'background.js'), 'utf8')).toContain(EXTERNAL_IMPORT);
    for (const e of UI_ENTRIES) {
      expect(readFileSync(path.join(chromeDist, 'ui', `${e}.js`), 'utf8'), e).toContain(EXTERNAL_IMPORT);
    }
  });
  it('removes the classic polyfill <script> from chrome HTML', () => {
    for (const f of htmlFiles(path.join(chromeDist, 'static'))) {
      expect(readFileSync(f, 'utf8'), f).not.toContain('vendor/browser-polyfill.js');
    }
  });
});
