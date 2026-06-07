import { describe, expect, it, vi } from 'vitest';
import { createOffscreenMarkdownConverter } from '../../src/services/markdown-converter.js';
import { OFFSCREEN_MARKDOWN_TARGET } from '../../src/contracts/offscreen-messages.js';
import type { OffscreenDocumentService } from '../../src/services/offscreen-document-service.js';

const OPTS = { headingStyle: 'atx' as const };

describe('createOffscreenMarkdownConverter', () => {
  it('posts a markdown-target message and returns the markdown', async () => {
    const sendMessage = vi.fn(async () => ({ ok: true, markdown: '# Hi' }));
    const docService: OffscreenDocumentService = { sendMessage: sendMessage as any };
    const converter = createOffscreenMarkdownConverter(docService);

    await expect(converter.convert('<h1>Hi</h1>', OPTS)).resolves.toBe('# Hi');
    expect(sendMessage).toHaveBeenCalledWith({
      target: OFFSCREEN_MARKDOWN_TARGET,
      html: '<h1>Hi</h1>',
      options: OPTS,
    });
  });

  it('throws when the offscreen document reports failure', async () => {
    const sendMessage = vi.fn(async () => ({ ok: false, error: 'boom' }));
    const docService: OffscreenDocumentService = { sendMessage: sendMessage as any };
    const converter = createOffscreenMarkdownConverter(docService);

    await expect(converter.convert('<h1>Hi</h1>', OPTS)).rejects.toThrow('offscreen markdown conversion failed: boom');
  });
});
