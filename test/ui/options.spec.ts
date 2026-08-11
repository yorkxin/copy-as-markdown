import { page } from 'vitest/browser';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const selectionSettingsMock = {
  setBulletListMarker: vi.fn(),
  setCodeBlockStyle: vi.fn(),
  reset: vi.fn(),
  keys: [],
};

const multipleLinksSettingsMock = {
  setBulletListMarker: vi.fn(),
  setTabGroupIndentation: vi.fn(),
  reset: vi.fn(),
  keys: [],
};

const readMarkdownSettingsMock = vi.fn();
const loadMarkdownSettingsMock = vi.fn();
const setSharedBulletListMarkerMock = vi.fn();
const resetMarkdownSettingsMock = vi.fn();

const loadPermissionsMock = vi.fn();
const PermissionStatusValue = {
  Yes: 'yes',
  No: 'no',
  Unavailable: 'unavailable',
} as const;

vi.mock('../../src/lib/selection-settings.js', () => ({
  default: selectionSettingsMock,
}));

vi.mock('../../src/lib/multiple-links-settings.js', () => ({
  default: multipleLinksSettingsMock,
}));

vi.mock('../../src/lib/markdown-settings.js', () => ({
  contextMarkdownSettingsKeys: [],
  readMarkdownSettings: readMarkdownSettingsMock,
  loadMarkdownSettings: loadMarkdownSettingsMock,
  setSharedBulletListMarker: setSharedBulletListMarkerMock,
  resetMarkdownSettings: resetMarkdownSettingsMock,
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
    const settings = {
      alwaysEscapeLinkBrackets: true,
      selection: { bulletListMarker: '*', codeBlockStyle: 'indented' },
      multipleLinks: { bulletListMarker: '*', tabGroupIndentation: 'tab' },
    };
    readMarkdownSettingsMock.mockResolvedValue(settings);
    loadMarkdownSettingsMock.mockResolvedValue(settings);
    loadPermissionsMock.mockResolvedValue(new Map([['tabGroups', PermissionStatusValue.Yes]]));

    // Load the options module - this will register DOM event listeners
    await import('../../src/ui/options.js');

    // Trigger initialization
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();
  });

  it('loads settings into the form', async () => {
    const asteriskRadio = page.getByRole('radio', { name: /Asterisks/ });
    await expect.element(asteriskRadio).toBeChecked();

    const tabRadio = page.getByRole('radio', { name: /^Tab$/ });
    await expect.element(tabRadio).toBeChecked();

    const indentedCodeBlockRadio = page.getByRole('radio', { name: /Indented code block/ });
    await expect.element(indentedCodeBlockRadio).toBeChecked();
  });

  it('enables tab group indentation when permission is granted', async () => {
    // Verify that tab group indentation options are enabled when permission is granted
    const spacesRadio = page.getByRole('radio', { name: /^Spaces$/ });
    await expect.element(spacesRadio).toBeEnabled();

    const tabRadio = page.getByRole('radio', { name: /^Tab$/ });
    await expect.element(tabRadio).toBeEnabled();
  });

  it('hides or shows permission badges based on permissions', async () => {
    // The tag should be hidden when tabGroups permission is granted (has is-hidden class)
    await expect.element(page.getByTestId('requires-permissions-tab-groups')).to.toHaveClass('is-hidden');
  });

  it('no longer presents the link-text escaping control', async () => {
    expect(document.querySelector('#form-link-text-always-escape-brackets')).toBeNull();
  });

  it('writes the bullet list marker for both contexts in one save', async () => {
    setSharedBulletListMarkerMock.mockClear();
    setSharedBulletListMarkerMock.mockResolvedValue(undefined);

    const plusRadio = page.getByRole('radio', { name: /Plus Signs/ });
    await expect.element(plusRadio).toBeInTheDocument();

    await plusRadio.click();

    expect(setSharedBulletListMarkerMock).toHaveBeenCalledWith('+');
    expect(setSharedBulletListMarkerMock).toHaveBeenCalledTimes(1);
  });

  it('shows flash on save failure', async () => {
    setSharedBulletListMarkerMock.mockClear();
    setSharedBulletListMarkerMock.mockRejectedValueOnce(new Error('fail'));

    const dashRadio = page.getByRole('radio', { name: /Dashes/ });
    await expect.element(dashRadio).toBeInTheDocument();

    await dashRadio.click();

    expect(setSharedBulletListMarkerMock).toHaveBeenCalled();

    const flash = page.getByTestId('flash-error');
    await expect.element(flash).toBeVisible();
  });

  it('saves code block style on change', async () => {
    selectionSettingsMock.setCodeBlockStyle.mockClear();
    selectionSettingsMock.setCodeBlockStyle.mockResolvedValue(undefined);

    const fencedRadio = page.getByRole('radio', { name: /Fenced code block/ });
    await expect.element(fencedRadio).toBeInTheDocument();

    await fencedRadio.click();

    expect(selectionSettingsMock.setCodeBlockStyle).toHaveBeenCalledWith('fenced');
  });

  it('saves tab group indentation to the Multiple Links context', async () => {
    multipleLinksSettingsMock.setTabGroupIndentation.mockClear();
    multipleLinksSettingsMock.setTabGroupIndentation.mockResolvedValue(undefined);

    const spacesRadio = page.getByRole('radio', { name: /^Spaces$/ });
    await expect.element(spacesRadio).toBeInTheDocument();

    await spacesRadio.click();

    expect(multipleLinksSettingsMock.setTabGroupIndentation).toHaveBeenCalledWith('spaces');
  });

  it('resets every context the combined page still owns, in one removal', async () => {
    resetMarkdownSettingsMock.mockClear().mockResolvedValue(undefined);

    const resetButton = page.getByRole('button', { name: /Restore to Default/ });
    await resetButton.click();

    expect(resetMarkdownSettingsMock).toHaveBeenCalledTimes(1);
  });
});

describe('options UI - with permissions denied', () => {
  beforeAll(async () => {
    // Reset DOM and set up a new scenario
    await loadOptionsHtml();
    mockBrowser();

    // Set up mock responses with permissions denied
    const settings = {
      alwaysEscapeLinkBrackets: false,
      selection: { bulletListMarker: '-', codeBlockStyle: 'fenced' },
      multipleLinks: { bulletListMarker: '-', tabGroupIndentation: 'spaces' },
    };
    readMarkdownSettingsMock.mockResolvedValue(settings);
    loadMarkdownSettingsMock.mockResolvedValue(settings);
    loadPermissionsMock.mockResolvedValue(new Map([['tabGroups', PermissionStatusValue.No]]));

    // Since module is already loaded, we trigger DOMContentLoaded again
    // The module's event listener will fire again
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();
  });

  it('disables tab group indentation when permission not granted', async () => {
    const spacesRadio = page.getByRole('radio', { name: /^Spaces$/ });
    await expect.element(spacesRadio).toBeDisabled();

    const tabRadio = page.getByRole('radio', { name: /^Tab$/ });
    await expect.element(tabRadio).toBeDisabled();
  });
});
