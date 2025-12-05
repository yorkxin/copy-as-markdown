import { page } from '@vitest/browser/context';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const settingsMock = {
  getAll: vi.fn(),
  setLinkTextAlwaysEscapeBrackets: vi.fn(),
  setStyleOfUnrderedList: vi.fn(),
  setStyleTabGroupIndentation: vi.fn(),
  reset: vi.fn(),
  keys: [],
};

const loadPermissionsMock = vi.fn();
const PermissionStatusValue = {
  Yes: 'yes',
  No: 'no',
  Unavailable: 'unavailable',
} as const;

// Mock the settings module
vi.mock('../../src/lib/settings.js', () => ({
  default: settingsMock,
}));

// Mock the permissions UI module
vi.mock('../../src/ui/permissions-ui.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/ui/permissions-ui.js')>();
  return {
    ...actual,
    loadPermissions: loadPermissionsMock,
  };
});

async function loadOptionsHtml(): Promise<void> {
  const response = await fetch('/src/static/options.html');
  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
}

function mockBrowser() {
  (globalThis as any).browser = {
    storage: { sync: { onChanged: { addListener: vi.fn() } } },
  };
}

async function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 100));
}

describe('options UI - with permissions granted', () => {
  beforeAll(async () => {
    // Set up environment before loading the module
    await loadOptionsHtml();
    mockBrowser();

    // Set up initial mock responses
    settingsMock.getAll.mockResolvedValue({
      alwaysEscapeLinkBrackets: true,
      styleOfUnorderedList: 'asterisk',
      styleOfTabGroupIndentation: 'tab',
    });
    loadPermissionsMock.mockResolvedValue(new Map([['tabGroups', PermissionStatusValue.Yes]]));

    // Load the options module - this will register DOM event listeners
    await import('../../src/ui/options.js');

    // Trigger initialization
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();
  });

  it('loads settings into the form', async () => {
    const escapeCheckbox = page.getByRole('checkbox', { name: /Always escape brackets/ });
    await expect.element(escapeCheckbox).toBeChecked();

    const asteriskRadio = page.getByRole('radio', { name: /Asterisks/ });
    await expect.element(asteriskRadio).toBeChecked();

    const tabRadio = page.getByRole('radio', { name: /^Tab$/ });
    await expect.element(tabRadio).toBeChecked();
  });

  it('enables tab group indentation when permission is granted', async () => {
    // Verify that tab group indentation options are enabled when permission is granted
    const spacesRadio = page.getByRole('radio', { name: /Spaces/ });
    await expect.element(spacesRadio).toBeEnabled();

    const tabRadio = page.getByRole('radio', { name: /^Tab$/ });
    await expect.element(tabRadio).toBeEnabled();
  });

  it('hides or shows permission badges based on permissions', async () => {
    // The tag should be hidden when tabGroups permission is granted (has is-hidden class)
    await expect.element(page.getByTestId('requires-permissions-tab-groups')).to.toHaveClass('is-hidden');
  });

  it('saves settings on change', async () => {
    settingsMock.setLinkTextAlwaysEscapeBrackets.mockClear();
    settingsMock.setLinkTextAlwaysEscapeBrackets.mockResolvedValue(undefined);

    const escapeCheckbox = page.getByRole('checkbox', { name: /Always escape brackets/ });
    await expect.element(escapeCheckbox).toBeInTheDocument();

    // Toggle the checkbox
    await escapeCheckbox.click();

    expect(settingsMock.setLinkTextAlwaysEscapeBrackets).toHaveBeenCalledWith(false);

    // Verify no error flash is shown
    const flash = page.getByTestId('flash-error');
    await expect.element(flash).not.toBeVisible();
  });

  it('shows flash on save failure', async () => {
    settingsMock.setStyleOfUnrderedList.mockClear();
    settingsMock.setStyleOfUnrderedList.mockRejectedValueOnce(new Error('fail'));

    const dashRadio = page.getByRole('radio', { name: /Dashes/ });
    await expect.element(dashRadio).toBeInTheDocument();

    await dashRadio.click();

    expect(settingsMock.setStyleOfUnrderedList).toHaveBeenCalled();

    const flash = page.getByTestId('flash-error');
    await expect.element(flash).toBeVisible();
  });
});

describe('options UI - with permissions denied', () => {
  beforeAll(async () => {
    // Reset DOM and set up a new scenario
    await loadOptionsHtml();
    mockBrowser();

    // Set up mock responses with permissions denied
    settingsMock.getAll.mockResolvedValue({
      alwaysEscapeLinkBrackets: false,
      styleOfUnorderedList: 'dash',
      styleOfTabGroupIndentation: 'spaces',
    });
    loadPermissionsMock.mockResolvedValue(new Map([['tabGroups', PermissionStatusValue.No]]));

    // Since module is already loaded, we trigger DOMContentLoaded again
    // The module's event listener will fire again
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();
  });

  it('disables tab group indentation when permission not granted', async () => {
    const spacesRadio = page.getByRole('radio', { name: /Spaces/ });
    await expect.element(spacesRadio).toBeDisabled();

    const tabRadio = page.getByRole('radio', { name: /^Tab$/ });
    await expect.element(tabRadio).toBeDisabled();
  });
});
