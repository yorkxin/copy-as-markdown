import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const bundlePath = path.join(root, 'chrome', 'dist', 'background.js');

describe('chrome background bundle', () => {
  beforeAll(() => {
    // Build the Chrome target so the assertion runs against fresh output.
    execSync('node scripts/build.js chrome', { cwd: root, stdio: 'inherit' });
  }, 120_000);

  it('does not bundle Turndown (DOM-only) code', () => {
    const source = readFileSync(bundlePath, 'utf8');
    expect(source).not.toMatch(/TurndownService/);
  });
});
