import { describe, expect, it } from 'vitest';
import { convertHtmlMessage } from '../../src/offscreen.js';
import { OFFSCREEN_MARKDOWN_TARGET } from '../../src/contracts/offscreen-messages.js';

describe('convertHtmlMessage', () => {
  it('converts HTML and returns markdown', () => {
    expect(convertHtmlMessage({
      target: OFFSCREEN_MARKDOWN_TARGET,
      html: '<h1>Hi</h1>',
      options: { headingStyle: 'atx' },
    })).toEqual({ ok: true, markdown: '# Hi' });
  });

  it('returns an error when conversion throws', () => {
    const result = convertHtmlMessage({
      target: OFFSCREEN_MARKDOWN_TARGET,
      // @ts-expect-error force a throw
      html: null,
      options: { headingStyle: 'atx' },
    });
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe('string');
  });
});
