import { describe, expect, it } from 'vitest';
import { createEventPageMarkdownConverter } from '../../src/services/markdown-converter.js';

describe('createEventPageMarkdownConverter', () => {
  it('converts HTML to Markdown in-page via the lazy import', async () => {
    const converter = createEventPageMarkdownConverter();
    await expect(converter.convert('<h1>Hi</h1><p>x</p>', { headingStyle: 'atx' }))
      .resolves.toBe('# Hi\n\nx');
  });
});
