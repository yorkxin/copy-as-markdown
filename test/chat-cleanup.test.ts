import { describe, expect, it } from 'vitest';
import { cleanChatMarkdown } from '../src/lib/chat-cleanup';

const WIDGETS = [
  'Copied to clipboardFailed to copy to clipboard. Try again later.',
  '',
  'CopiedFailed to copyCopy',
  '',
  '# Share public link',
  '',
  'Good response',
  '',
  'Show allShow less',
].join('\n');

describe('cleanChatMarkdown', () => {
  it('drops the widget block and starts a new user turn', () => {
    const md = `answer one\n\n${WIDGETS}\n\nnext question\n\n### AI Mode reply for next question\n\nanswer two\n`;
    expect(cleanChatMarkdown(md))
      .toBe('answer one\n\n---\n\n## User\n\nnext question\n\n### Assistant\n\nanswer two\n');
  });

  it('drops a trailing turn break at the end of the text', () => {
    expect(cleanChatMarkdown(`answer\n\n${WIDGETS}\n`)).toBe('answer\n');
  });

  it('removes UI labels, dates, You said headings and citations', () => {
    const md = '## You said: hi\n\nCopied\n\nCopy\n\nEdit\n\nhi\n\nOctober 9, 2026\n\n**Searching**\n\nMouser Electronics +1\n\nkeep me\n';
    expect(cleanChatMarkdown(md)).toBe('hi\n\nkeep me\n');
  });

  it('removes citation lines that contain a non-breaking space', () => {
    expect(cleanChatMarkdown('text\n\nVishay\u00A0+2\n\nmore\n')).toBe('text\n\nmore\n');
  });

  it('removes placeholder and favicon images but keeps real images', () => {
    const md = [
      '![](data:image/gif;base64,R0lGOD)',
      '![](https://encrypted-tbn0.gstatic.com/faviconV2?url=https://www.ti.com)',
      '![diagram](https://example.com/diagram.png)',
    ].join('\n\n');
    expect(cleanChatMarkdown(md)).toBe('![diagram](https://example.com/diagram.png)\n');
  });

  it('leaves table rows and list items alone', () => {
    const md = '| A | B +1 |\n| --- | --- |\n\n- item +2\n';
    expect(cleanChatMarkdown(md)).toBe(md);
  });

  it('drops page chrome before the conversation title and the footer after the last turn', () => {
    const md = `Skip to main content\n\nAI Mode\n\n## Notebooks\n\n# AI Mode conversation: Topic\n\nquestion\n\n### AI Mode reply for question\n\nanswer\n\n${WIDGETS}\n\n# Shared\n\n0 files\n\nGoogle Account\n`;
    expect(cleanChatMarkdown(md))
      .toBe('# AI Mode conversation: Topic\n\nquestion\n\n### Assistant\n\nanswer\n');
  });

  it('leaves text without a page title untouched by the page cuts', () => {
    expect(cleanChatMarkdown('intro\n\n# Shared\n\nstuff\n')).toBe('intro\n\n# Shared\n\nstuff\n');
  });

  it('keeps later turns when a Shared heading appears mid-conversation', () => {
    const md = '# AI Mode conversation: T\n\nq1\n\n9:07\n\na1\n\n# Shared\n\nq2\n\na2\n\n# Shared\n\n0 files\n';
    const out = cleanChatMarkdown(md);
    expect(out).toContain('a2');
    expect(out).not.toContain('0 files');
    expect(out).not.toContain('9:07');
  });
});
