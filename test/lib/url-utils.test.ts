import { describe, expect, it } from 'vitest';
import { selectivelyDecodeUrl } from '../../src/lib/url-utils';

describe('selectivelyDecodeUrl', () => {
  it('decodes Unicode characters', () => {
    expect(selectivelyDecodeUrl('https://example.com/%E4%B8%AD%E6%96%87'))
      .toBe('https://example.com/中文');
    expect(selectivelyDecodeUrl('https://example.com/%E6%97%A5%E6%9C%AC%E8%AA%9E'))
      .toBe('https://example.com/日本語');
  });

  it('keeps spaces encoded as %20', () => {
    expect(selectivelyDecodeUrl('https://example.com/hello%20world'))
      .toBe('https://example.com/hello%20world');
    expect(selectivelyDecodeUrl('https://example.com/%20'))
      .toBe('https://example.com/%20');
  });

  it('keeps parentheses encoded as %28 and %29', () => {
    expect(selectivelyDecodeUrl('https://example.com/test%28%29'))
      .toBe('https://example.com/test%28%29');
    expect(selectivelyDecodeUrl('https://example.com/%28paren%29'))
      .toBe('https://example.com/%28paren%29');
  });

  it('decodes other percent-encoded characters', () => {
    // Reserved characters that are safe to decode in markdown URLs
    expect(selectivelyDecodeUrl('https://example.com/%3Fquery%3D1%26key%3D2'))
      .toBe('https://example.com/?query=1&key=2');
    expect(selectivelyDecodeUrl('https://example.com/%23hash'))
      .toBe('https://example.com/#hash');
    expect(selectivelyDecodeUrl('https://example.com/%2Fpath'))
      .toBe('https://example.com//path'); // double slash, but okay
  });

  it('handles mixed encoded sequences', () => {
    expect(selectivelyDecodeUrl('https://example.com/%E4%B8%AD%E6%96%87%20test%28%29%3Fq%3D%26'))
      .toBe('https://example.com/中文%20test%28%29?q=&');
  });

  it('returns original URL on malformed percent-encoding', () => {
    const malformed = 'https://example.com/%XX';
    expect(selectivelyDecodeUrl(malformed)).toBe(malformed);
    // Incomplete sequence
    expect(selectivelyDecodeUrl('https://example.com/%E4%')).toBe('https://example.com/%E4%');
  });

  it('handles already decoded URLs', () => {
    expect(selectivelyDecodeUrl('https://example.com/中文 test()'))
      .toBe('https://example.com/中文%20test%28%29');
  });

  it('handles empty string', () => {
    expect(selectivelyDecodeUrl('')).toBe('');
  });

  it('handles URL with plus signs (not encoded spaces)', () => {
    // Plus signs are not percent-encoded, they stay as plus
    expect(selectivelyDecodeUrl('https://example.com/hello+world'))
      .toBe('https://example.com/hello+world');
  });

  it('handles percent sign encoding (%25)', () => {
    // %25 should be decoded to % (since not in deny list)
    expect(selectivelyDecodeUrl('https://example.com/%25'))
      .toBe('https://example.com/%');
    // Double encoding: %2520 -> %20 (since %25 decoded to %, then %20 stays encoded)
    expect(selectivelyDecodeUrl('https://example.com/%2520'))
      .toBe('https://example.com/%20');
  });
});
