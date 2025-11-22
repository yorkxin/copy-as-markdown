// @vitest-environment jsdom

import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const html = fs.readFileSync(path.join(process.cwd(), 'src/static/custom-format.html'), 'utf8');

const storageMock = {
  get: vi.fn(),
  save: vi.fn(),
};

class MockCustomFormat {
  slot: string;
  context: string;
  name: string;
  template: string;
  showInMenus: boolean;

  constructor(opts: any) {
    this.slot = opts.slot;
    this.context = opts.context;
    this.name = opts.name;
    this.template = opts.template;
    this.showInMenus = opts.showInMenus;
  }

  render(): string {
    if (this.template.includes('bad')) {
      throw new Error('bad template');
    }
    return `rendered:${this.template}`;
  }

  get displayName(): string {
    return this.name || `Custom Format ${this.slot}`;
  }
}

vi.mock('../../src/storage/custom-formats-storage.js', () => ({
  __esModule: true,
  default: storageMock,
}));

vi.mock('../../src/lib/custom-format.js', () => ({
  __esModule: true,
  default: MockCustomFormat,
}));

vi.mock('../../src/ui/menu.js', () => ({
  __esModule: true,
  menuView: () => null,
  renderMenu: vi.fn(),
  default: vi.fn(),
}));

function resetDom(): void {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
  Object.defineProperty(window, 'location', {
    value: {
      href: 'https://example.com/custom-format.html',
      search: '',
      pathname: 'custom-format.html',
    },
    writable: true,
  });
  (globalThis as any).browser = {};
  storageMock.get.mockReset();
  storageMock.save.mockReset();
}

function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('custom format UI', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    resetDom();
  });

  function setLocation(search: string): void {
    (window.location as any).search = search;
    (window.location as any).href = `https://example.com/custom-format.html${search}`;
  }

  it('loads and renders custom format', async () => {
    storageMock.get.mockResolvedValue(new MockCustomFormat({
      slot: '1',
      context: 'multiple-links',
      name: 'My Format',
      template: 'tmpl',
      showInMenus: true,
    }));

    setLocation('?context=multiple-links&slot=1');
    await import('../../src/ui/custom-format.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();

    const nameInput = document.getElementById('input-name') as HTMLInputElement;
    const templateInput = document.getElementById('input-template') as HTMLTextAreaElement;
    const showCheckbox = document.getElementById('input-show-in-menus') as HTMLInputElement;
    const preview = document.getElementById('preview') as HTMLTextAreaElement;

    expect(nameInput.value).toBe('My Format');
    expect(templateInput.value).toBe('tmpl');
    expect(showCheckbox.checked).toBe(true);
    expect(preview.value).toContain('rendered:tmpl');
  });

  it('shows template error and disables save on render failure', async () => {
    storageMock.get.mockResolvedValue(new MockCustomFormat({
      slot: '2',
      context: 'single-link',
      name: '',
      template: 'bad',
      showInMenus: false,
    }));

    setLocation('?context=single-link&slot=2');
    await import('../../src/ui/custom-format.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();

    const save = document.getElementById('save') as HTMLButtonElement;
    const error = document.getElementById('error-template') as HTMLParagraphElement;
    expect(save.disabled).toBe(true);
    expect(error.classList.contains('is-hidden')).toBe(false);
  });

  it('saves updated custom format', async () => {
    storageMock.get.mockResolvedValue(new MockCustomFormat({
      slot: '3',
      context: 'multiple-links',
      name: '',
      template: 'tmpl',
      showInMenus: false,
    }));

    setLocation('?context=multiple-links&slot=3');
    await import('../../src/ui/custom-format.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();

    const nameInput = document.getElementById('input-name') as HTMLInputElement;
    nameInput.value = 'New Name';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));

    const save = document.getElementById('save') as HTMLButtonElement;
    save.click();
    await flush();

    expect(storageMock.save).toHaveBeenCalled();
  });
});
