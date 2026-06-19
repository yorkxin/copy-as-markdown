/**
 * Helper utilities for E2E tests
 */

import type { BrowserContext, Page, Worker } from '@playwright/test';
import { spawn } from 'node:child_process';
import type { ClipboardMockCall } from '../../src/services/clipboard-service.js';

import process from 'node:process';

const CLIPBOARD_SEPARATOR = '=========== CLIPBOARD SEPARATOR ===========';
const MOCK_PERMISSION_STORAGE_KEY = '__pw_mock_optional_permissions__';

/**
 * Get all mock clipboard calls from the service worker
 */
export async function getMockClipboardCalls(serviceWorker: Worker): Promise<ClipboardMockCall[]> {
  return await serviceWorker.evaluate(async () => {
    const mock = (globalThis as any).__mockClipboardService;
    if (!mock) {
      throw new Error('Mock clipboard service not found in service worker');
    }
    return await mock.getCalls();
  });
}

/**
 * Reset the mock clipboard service in the service worker
 */
export async function resetMockClipboard(serviceWorker: Worker): Promise<void> {
  await serviceWorker.evaluate(async () => {
    // MV3 can evict and restart the service worker between when it was acquired
    // (mock mode enabled, __mockClipboardService created in memory) and this call.
    // A restarted worker starts with mockMode=false and no mock service — it's only
    // restored asynchronously by initializeMockState. Re-enable mock mode here, which
    // synchronously (re)creates the service AND ensures the upcoming export writes to
    // the mock rather than the real clipboard. reset() wants a fresh mock anyway.
    const setMock = (globalThis as any).setMockClipboardMode;
    if (typeof setMock === 'function') {
      await setMock(true);
    }
    const mock = (globalThis as any).__mockClipboardService;
    if (!mock) {
      throw new Error('Mock clipboard service not found in service worker');
    }
    await mock.reset();
  });
}

/**
 * Wait for the mock clipboard to have at least one call (with timeout)
 */
export async function waitForMockClipboard(serviceWorker: Worker, timeout = 3000): Promise<ClipboardMockCall> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const calls = await getMockClipboardCalls(serviceWorker);
    if (calls.length > 0) {
      return calls[calls.length - 1]!;
    }

    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`Mock clipboard had no calls after ${timeout}ms`);
}

/**
 * Programmatically trigger a context menu handler by dispatching the Chrome
 * onClicked event inside the service worker.
 */
export async function triggerContextMenu(
  serviceWorker: Worker,
  menuItemId: string,
  info: Partial<browser.contextMenus.OnClickData> = {},
  tabOverrides: Partial<browser.tabs.Tab> = {},
): Promise<void> {
  await serviceWorker.evaluate(async ({ menuItemId, info, tabOverrides }) => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      throw new Error('No active tab found');
    }

    const targetTab = { ...activeTab, ...tabOverrides };
    const clickInfo: browser.contextMenus.OnClickData = {
      menuItemId,
      pageUrl: targetTab.url,
      ...info,
    };

    // @ts-expect-error - dispatch exists in Chrome extension context
    chrome.contextMenus.onClicked.dispatch(clickInfo, targetTab);
  }, { menuItemId, info, tabOverrides });
}

/**
 * Get the service worker for the extension
 * Filters by chrome-extension:// URL to ensure we get the extension's worker,
 * not some other service worker (like from PWAs or other extensions)
 *
 * Also polls to ensure Chrome APIs are ready before returning
 */
export async function getServiceWorker(context: BrowserContext, timeout = 10000) {
  // Get all service workers and filter for extension workers
  const serviceWorkers = context.serviceWorkers();
  let extensionWorker = serviceWorkers.find(sw =>
    sw.url().startsWith('chrome-extension://'),
  );

  // If not found yet, wait for it
  if (!extensionWorker) {
    extensionWorker = await context.waitForEvent('serviceworker', {
      predicate: worker => worker.url().startsWith('chrome-extension://'),
      timeout,
    });
  }

  // Poll until Chrome APIs are ready
  const startTime = Date.now();
  const pollInterval = 500; // Check every 500ms

  while (Date.now() - startTime < timeout) {
    const workerState = await extensionWorker.evaluate(() => {
      // In service worker context, use globalThis which has ServiceWorkerGlobalScope
      return {
        readyState: (globalThis as any).registration?.active?.state,
        hasChrome: typeof chrome !== 'undefined',
        hasChromeCommands: typeof chrome?.commands !== 'undefined',
        // Set last in background.ts, after every top-level addListener call.
        listenersReady: (globalThis as any).__listenersReady === true,
        location: (globalThis as any).location.href,
      };
    });

    // Ready only once our listeners are registered — not merely when the
    // chrome.* API object exists. Closes the dispatch-before-listener race.
    if (workerState.listenersReady) {
      break;
    }

    // Chrome APIs not ready yet, wait and retry
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    // Get fresh service worker reference in case it was restarted
    const freshWorkers = context.serviceWorkers();
    const freshWorker = freshWorkers.find(sw =>
      sw.url().startsWith('chrome-extension://'),
    );

    if (freshWorker) {
      extensionWorker = freshWorker;
    }
  }

  if (!extensionWorker) {
    throw new Error(`Service worker listeners not ready (__listenersReady) after ${timeout}ms`);
  }

  await setMockClipboardMode(extensionWorker, true);
  return extensionWorker;
}

async function runClipboardCommand(
  direction: 'read' | 'write',
  input?: string,
): Promise<string> {
  const commandCandidates = getClipboardCommandCandidates(direction);
  let lastError: unknown;

  for (const candidate of commandCandidates) {
    const [command, ...args] = candidate;
    try {
      return await execClipboardCommand(command, args, input);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`No clipboard command succeeded for ${direction}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function execClipboardCommand(command: string, args: string[], input?: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args);
    const cmdLabel = [command, ...args].join(' ').trim();
    const timeoutMs = 1000;
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer: NodeJS.Timeout | null = null;

    const settle = (cb: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      cb();
    };

    if (input !== undefined && child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      console.error(`[clipboard] Command error (${cmdLabel}): ${error.message}`);
      settle(() => reject(error));
    });
    child.on('close', (code) => {
      if (code === 0) {
        settle(() => resolve(stdout));
      } else {
        settle(() => reject(new Error(`Command ${command} failed with code ${code}: ${stderr || stdout}`)));
      }
    });

    timer = setTimeout(() => {
      console.warn(`[clipboard] Command timeout (${cmdLabel}) after ${timeoutMs}ms`);
      child.kill('SIGKILL');
      settle(() => reject(new Error(`Command ${command} timed out after ${timeoutMs}ms`)));
    }, timeoutMs);
  });
}

function getClipboardCommandCandidates(direction: 'read' | 'write'): string[][] {
  if (process.platform === 'darwin') {
    return direction === 'read'
      ? [['pbpaste']]
      : [['pbcopy']];
  }

  if (process.platform === 'win32') {
    return direction === 'read'
      ? [['powershell', '-command', 'Get-Clipboard']]
      : [['powershell', '-command', 'Set-Clipboard -Value ([Console]::In.ReadToEnd())']];
  }

  // Linux / other Unix (Wayland + X11 fallbacks)
  const hasWayland = Boolean(process.env.WAYLAND_DISPLAY);
  const hasX11 = Boolean(process.env.DISPLAY);
  const candidates: string[][] = [];

  if (direction === 'read') {
    if (hasWayland) {
      candidates.push(['wl-paste']);
    }
    if (hasX11) {
      candidates.push(['xsel', '--clipboard', '--output']);
    }
  } else {
    if (hasWayland) {
      candidates.push(['wl-copy']);
    }
    if (hasX11) {
      candidates.push(['xsel', '--clipboard', '--input']);
    }
  }

  if (candidates.length === 0) {
    throw new Error('No clipboard commands available. Install wl-clipboard or {xsel,xclip} and ensure DISPLAY or WAYLAND_DISPLAY is set.');
  }

  return candidates;
}

async function readSystemClipboard(): Promise<string> {
  return await runClipboardCommand('read');
}

async function writeSystemClipboard(text: string): Promise<void> {
  await runClipboardCommand('write', text);
}

export async function resetSystemClipboard(): Promise<void> {
  await writeSystemClipboard(CLIPBOARD_SEPARATOR);

  const startTime = Date.now();
  const timeout = 3000;

  while (Date.now() - startTime < timeout) {
    try {
      const value = await readSystemClipboard();
      if (value === CLIPBOARD_SEPARATOR) {
        return;
      }
    } catch (error) {
      console.warn('Failed to verify clipboard reset:', error);
    }
    await wait(100);
  }

  console.warn(`System clipboard did not reset within ${timeout}ms`);
}

export async function waitForSystemClipboard(
  expected: string,
  timeout = 3000,
  normalize: (value: string) => string = value => value,
): Promise<string> {
  const startTime = Date.now();
  const want = normalize(expected);
  let lastSeen = '';

  while (Date.now() - startTime < timeout) {
    try {
      const value = await readSystemClipboard();
      if (value && value !== CLIPBOARD_SEPARATOR) {
        lastSeen = value;
        // Wait for THIS test's write specifically. The real system clipboard is
        // shared across the serial smoke specs, and the offscreen write path is
        // slow, so a prior test's write can land after this test reset the
        // clipboard. Returning the first non-sentinel value would capture that
        // stale contamination instead of the write we're actually waiting for.
        if (normalize(value) === want) {
          return value;
        }
      }
    } catch (error) {
      console.warn('Failed to read system clipboard:', error);
    }
    await wait(100);
  }

  // Timed out: return the last non-sentinel value seen (or '') so the caller's
  // expect() produces a meaningful diff rather than an opaque timeout error.
  return lastSeen;
}

export async function setMockClipboardMode(serviceWorker: Worker, enabled: boolean): Promise<void> {
  await serviceWorker.evaluate(async (flag) => {
    const setter = (globalThis as any).setMockClipboardMode;
    if (typeof setter !== 'function') {
      throw new TypeError('setMockClipboardMode is not available');
    }
    await setter(flag);
  }, enabled);
}

/**
 * Wait for a specific time (helper to make timeouts more readable)
 */
export async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function removeOptionalPermissions(serviceWorker: Worker, permissions: string[]): Promise<void> {
  await serviceWorker.evaluate(async (perms) => {
    await chrome.permissions.remove({ permissions: perms });
  }, permissions);
}

export async function hasPermissions(serviceWorker: Worker, permissions: string[]): Promise<boolean> {
  return await serviceWorker.evaluate(async (perms) => {
    return await chrome.permissions.contains({ permissions: perms });
  }, permissions);
}

function registerMockPermissions({ storageKey }: { storageKey: string }) {
  if (typeof chrome === 'undefined' || !chrome.permissions || (chrome.permissions as any).__pwMocked) {
    return;
  }

  const KEY = storageKey;

  function getGranted(): Promise<Set<string>> {
    return new Promise((resolve) => {
      chrome.storage.local.get({ [KEY]: [] }, (items) => {
        const list = Array.isArray(items[KEY]) ? items[KEY] as string[] : [];
        resolve(new Set(list));
      });
    });
  }

  function saveGranted(set: Set<string>): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [KEY]: Array.from(set) }, () => resolve());
    });
  }

  function wrap<T>(handler: (perms: string[]) => Promise<T>) {
    return (details: { permissions?: string[] } = {}, callback?: (result: T) => void) => {
      const permissions = details.permissions ?? [];
      const promise = handler(permissions);
      if (typeof callback === 'function') {
        promise.then(result => callback(result));
        return;
      }
      return promise;
    };
  }

  chrome.permissions.contains = wrap(async (permissions) => {
    const granted = await getGranted();
    return permissions.every(perm => granted.has(perm));
  });

  chrome.permissions.request = wrap(async (permissions) => {
    const granted = await getGranted();
    permissions.forEach(perm => granted.add(perm));
    await saveGranted(granted);
    return true;
  });

  chrome.permissions.remove = wrap(async (permissions) => {
    const granted = await getGranted();
    permissions.forEach(perm => granted.delete(perm));
    await saveGranted(granted);
    return true;
  });

  (chrome.permissions as any).__pwMocked = true;
}

export async function enableMockPermissions(serviceWorker: Worker): Promise<void> {
  await serviceWorker.evaluate(registerMockPermissions, { storageKey: MOCK_PERMISSION_STORAGE_KEY });
}

export async function injectMockPermissionsIntoPage(page: Page): Promise<void> {
  await page.addInitScript(registerMockPermissions, { storageKey: MOCK_PERMISSION_STORAGE_KEY });
}

export async function ensureCustomFormatsVisible(
  serviceWorker: Worker,
  context: 'single-link' | 'multiple-links',
  slots: string[],
): Promise<void> {
  await serviceWorker.evaluate(async ({ ctx, slots }) => {
    const assignments: Record<string, unknown> = {};
    for (const slot of slots) {
      assignments[`custom_formats.${ctx}.${slot}.show_in_menus`] = true;
    }
    await chrome.storage.sync.set(assignments);
  }, { ctx: context, slots });
}

/**
 * Grant optional permissions to the extension
 * This requests permissions programmatically without user interaction
 */
export async function grantOptionalPermissions(
  page: Page,
  permissions: string[],
): Promise<boolean> {
  try {
    // Request permissions using Chrome API
    const granted = await page.evaluate(async (perms) => {
      // Check if already granted
      const hasPermissions = await chrome.permissions.contains({ permissions: perms });
      if (hasPermissions) {
        return true;
      }

      // Request permissions
      // Note: In test environment, this should grant automatically
      return await chrome.permissions.request({ permissions: perms });
    }, permissions);

    console.log(`Permissions ${permissions.join(', ')} granted:`, granted);
    return granted;
  } catch (error) {
    console.error('Failed to grant permissions:', error);
    return false;
  }
}
