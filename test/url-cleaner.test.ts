import { describe, expect, it } from 'vitest';
import { cleanUrl, createUrlCleaner, DEFAULT_TRACKING_PARAMS } from '../src/lib/url-cleaner.js';

describe('url-cleaner', () => {
  describe('cleanUrl', () => {
    describe('removes spm parameter', () => {
      it('should remove spm from Aliyun URL', () => {
        const url = 'https://www.aliyun.com/exp/llm?spm=5176.42028462.J_zsjI5GlfrwE0jnH6hsdfr.3.e939154ai51unt';
        const expected = 'https://www.aliyun.com/exp/llm';
        expect(cleanUrl(url)).toBe(expected);
      });

      it('should remove spm and keep other params from Alibaba URL', () => {
        const url = 'https://fbi.alibaba-inc.com/dashboard/view/page.htm?spm=a2o1z.8190073.0.0.d7a0543flHuS4p&id=1392902';
        const expected = 'https://fbi.alibaba-inc.com/dashboard/view/page.htm?id=1392902';
        expect(cleanUrl(url)).toBe(expected);
      });

      it('should handle spm in the middle of params', () => {
        const url = 'https://example.com?id=1&spm=abc123&page=2';
        const expected = 'https://example.com/?id=1&page=2';
        expect(cleanUrl(url)).toBe(expected);
      });
    });

    describe('removes UTM parameters', () => {
      it('should remove all UTM params', () => {
        const url = 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test&id=123';
        const expected = 'https://example.com/?id=123';
        expect(cleanUrl(url)).toBe(expected);
      });

      it('should remove utm_term and utm_content', () => {
        const url = 'https://example.com?utm_term=keyword&utm_content=banner&page=1';
        const expected = 'https://example.com/?page=1';
        expect(cleanUrl(url)).toBe(expected);
      });
    });

    describe('removes other tracking parameters', () => {
      it('should remove Facebook fbclid', () => {
        const url = 'https://example.com?fbclid=IwAR3xyz&article=123';
        const expected = 'https://example.com/?article=123';
        expect(cleanUrl(url)).toBe(expected);
      });

      it('should remove Google gclid', () => {
        const url = 'https://example.com?gclid=abc123&product=456';
        const expected = 'https://example.com/?product=456';
        expect(cleanUrl(url)).toBe(expected);
      });

      it('should remove Microsoft msclkid', () => {
        const url = 'https://example.com?msclkid=xyz789&item=100';
        const expected = 'https://example.com/?item=100';
        expect(cleanUrl(url)).toBe(expected);
      });

      it('should remove scm parameter', () => {
        const url = 'https://example.com?scm=abc&id=1';
        const expected = 'https://example.com/?id=1';
        expect(cleanUrl(url)).toBe(expected);
      });
    });

    describe('case insensitivity', () => {
      it('should remove SPM (uppercase)', () => {
        const url = 'https://example.com?SPM=abc123&id=1';
        const expected = 'https://example.com/?id=1';
        expect(cleanUrl(url)).toBe(expected);
      });

      it('should remove UTM_SOURCE (uppercase)', () => {
        const url = 'https://example.com?UTM_SOURCE=google&id=1';
        const expected = 'https://example.com/?id=1';
        expect(cleanUrl(url)).toBe(expected);
      });
    });

    describe('edge cases', () => {
      it('should return original URL if no tracking params', () => {
        const url = 'https://example.com?id=123&page=2';
        // Note: URL object normalizes the URL by adding a trailing slash before query
        expect(cleanUrl(url)).toBe('https://example.com/?id=123&page=2');
      });

      it('should handle URL without query params', () => {
        const url = 'https://example.com/page';
        expect(cleanUrl(url)).toBe('https://example.com/page');
      });

      it('should handle empty string', () => {
        expect(cleanUrl('')).toBe('');
      });

      it('should handle invalid URL gracefully', () => {
        const invalidUrl = 'not-a-valid-url';
        expect(cleanUrl(invalidUrl)).toBe(invalidUrl);
      });

      it('should handle URL with hash', () => {
        const url = 'https://example.com?spm=abc#section';
        const expected = 'https://example.com/#section';
        expect(cleanUrl(url)).toBe(expected);
      });

      it('should remove all params if all are tracking params', () => {
        const url = 'https://example.com?spm=abc&utm_source=google&fbclid=xyz';
        const expected = 'https://example.com/';
        expect(cleanUrl(url)).toBe(expected);
      });

      it('should handle multiple spm-like params', () => {
        const url = 'https://example.com?spm=a&scm=b&id=1';
        const expected = 'https://example.com/?id=1';
        expect(cleanUrl(url)).toBe(expected);
      });
    });

    describe('custom params list', () => {
      it('should only remove specified params', () => {
        const url = 'https://example.com?spm=abc&custom=123&id=1';
        const expected = 'https://example.com/?spm=abc&id=1';
        expect(cleanUrl(url, ['custom'])).toBe(expected);
      });

      it('should handle empty params list', () => {
        const url = 'https://example.com?spm=abc&id=1';
        // Note: URL object normalizes the URL by adding a trailing slash before query
        expect(cleanUrl(url, [])).toBe('https://example.com/?spm=abc&id=1');
      });
    });
  });

  describe('DEFAULT_TRACKING_PARAMS', () => {
    it('should include spm', () => {
      expect(DEFAULT_TRACKING_PARAMS).toContain('spm');
    });

    it('should include common UTM params', () => {
      expect(DEFAULT_TRACKING_PARAMS).toContain('utm_source');
      expect(DEFAULT_TRACKING_PARAMS).toContain('utm_medium');
      expect(DEFAULT_TRACKING_PARAMS).toContain('utm_campaign');
    });

    it('should include major platform tracking params', () => {
      expect(DEFAULT_TRACKING_PARAMS).toContain('fbclid');
      expect(DEFAULT_TRACKING_PARAMS).toContain('gclid');
      expect(DEFAULT_TRACKING_PARAMS).toContain('msclkid');
    });
  });

  describe('createUrlCleaner', () => {
    it('should create a cleaner with default params', () => {
      const cleaner = createUrlCleaner();
      const url = 'https://example.com?spm=abc&id=1';
      const expected = 'https://example.com/?id=1';
      expect(cleaner(url)).toBe(expected);
    });

    it('should create a cleaner with custom params', () => {
      const cleaner = createUrlCleaner(['custom_param']);
      const url = 'https://example.com?custom_param=abc&spm=xyz&id=1';
      const expected = 'https://example.com/?spm=xyz&id=1';
      expect(cleaner(url)).toBe(expected);
    });
  });
});
