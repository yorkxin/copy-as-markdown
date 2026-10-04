import { afterEach, describe, expect, it, vi } from 'vitest';
import SelectionSettings from '../../src/lib/selection-settings.js';
import { convertHtmlMessage } from '../../src/offscreen.js';
import { createEventPageMarkdownConverter, createOffscreenMarkdownConverter } from '../../src/services/markdown-converter.js';
import { createOffscreenDocumentService } from '../../src/services/offscreen-document-service.js';
import { createFakeSyncStorage } from '../support/fake-sync-storage.js';

const storage = createFakeSyncStorage();
const html = '<h1>Heading</h1><p><em>italic</em> and <strong>bold</strong> with '
  + '<a href="https://example.com/">Example</a></p><ul><li>item</li></ul>'
  + '<pre><code class="language-js">const x = 1;\n</code></pre>';
const prefix = 'Heading\n=======\n\n*italic* and __bold__ with ';
const suffix = '\n\n+   item\n\n~~~js\nconst x = 1;\n~~~';

afterEach(() => storage.uninstall());

function createOffscreenConverter() {
  // Simulate only the browser transport; use the real document service, adapter,
  // offscreen message handler and Turndown conversion on a cloned message.
  const sendMessage = vi.fn();
  sendMessage.mockImplementation(async message => convertHtmlMessage(structuredClone(message)));
  return createOffscreenMarkdownConverter(createOffscreenDocumentService(
    { createDocument: vi.fn().mockResolvedValue(undefined) },
    { getContexts: vi.fn().mockResolvedValue([]), sendMessage },
  ));
}

describe('selection settings through browser conversion adapters', () => {
  it.each([
    ['Chrome offscreen', createOffscreenConverter],
    ['Firefox event page', createEventPageMarkdownConverter],
  ] as const)('%s applies validated mixed settings and changed options on the same converter', async (_name, createConverter) => {
    storage.data = {
      'selection.markdown.headingStyle': 'setext',
      'selection.markdown.emDelimiter': '*',
      'selection.markdown.strongDelimiter': '__',
      'selection.markdown.bulletListMarker': '+',
      'selection.markdown.codeBlockStyle': 'fenced',
      'selection.markdown.fence': '~~~',
      'selection.markdown.linkStyle': 'referenced',
      'selection.markdown.linkReferenceStyle': 'shortcut',
    };
    storage.install();
    const converter = createConverter();
    expect(await converter.convert(html, await SelectionSettings.getAll()))
      .toBe(`${prefix}[Example]${suffix}\n\n[Example]: https://example.com/`);

    await SelectionSettings.setLinkStyle('inlined');
    expect(await converter.convert(html, await SelectionSettings.getAll()))
      .toBe(`${prefix}[Example](https://example.com/)${suffix}`);
    expect(storage.data['selection.markdown.linkReferenceStyle']).toBe('shortcut');

    storage.data['selection.markdown.linkReferenceStyle'] = 'future';
    await SelectionSettings.setLinkStyle('referenced');
    expect(await converter.convert(html, await SelectionSettings.getAll()))
      .toBe(`${prefix}[Example][1]${suffix}\n\n[1]: https://example.com/`);
    expect(storage.data['selection.markdown.linkReferenceStyle']).toBe('future');
  });
});
