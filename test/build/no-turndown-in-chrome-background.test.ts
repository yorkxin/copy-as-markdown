import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const bundlePath = path.join(root, 'chrome', 'dist', 'background.js');

// Both extension targets are built once by test/build/global-setup.ts before the suite runs.
describe('chrome background bundle', () => {
  it('does not bundle Turndown (DOM-only) code', () => {
    const source = readFileSync(bundlePath, 'utf8');
    expect(source).not.toMatch(/TurndownService/);
  });
});
