import { afterEach, expect, it, vi } from 'vitest';
// `?raw` gives the verbatim file content (no Vite/CJS transform) — the exact file we ship.
import polyfillSource from '../../node_modules/webextension-polyfill/dist/browser-polyfill.js?raw';

afterEach(() => {
  document.getElementById('polyfill-under-test')?.remove();
  delete (window as any).browser;
  delete (window as any).chrome;
});

it('verbatim ESM import self-installs window.browser (old-Chrome path)', async () => {
  // Plain Chromium page has no native `browser` (that's Firefox), so a pass proves the
  // polyfill itself installed it — no false positive. Stub the minimal `chrome` the
  // polyfill guards on so it takes the wrapAPIs install branch instead of throwing.
  (window as any).chrome = { runtime: { id: 'test-extension-id' } };
  expect((window as any).browser).toBeUndefined();

  // A dynamically inserted <script type="module"> with inline content executes as ESM.
  const script = document.createElement('script');
  script.type = 'module';
  script.id = 'polyfill-under-test';
  script.textContent = polyfillSource;
  document.head.appendChild(script);

  await vi.waitFor(() => {
    expect((window as any).browser).toBeDefined();
  }, { timeout: 800, interval: 20 });

  expect(typeof (window as any).browser).toBe('object');
  expect((window as any).browser).toHaveProperty('runtime');
});
