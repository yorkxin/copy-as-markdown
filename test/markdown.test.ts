import { describe, expect, it } from 'vitest';
import Markdown, { TabGroupIndentationStyle, UnorderedListStyle } from '../src/lib/markdown';

describe('markdown', () => {
  it('default properties', () => {
    const markdown = new Markdown({});
    expect(markdown.alwaysEscapeLinkBracket).toBe(false);
  });

  describe('list()', () => {
    it('defaults to dash', () => {
      const markdown = new Markdown();
      expect(markdown.list(['a', 'b', 'c'])).toBe('- a\n- b\n- c\n');
    });

    it('can set a character', () => {
      const markdown = new Markdown({ unorderedListStyle: UnorderedListStyle.Asterisk });
      expect(markdown.list(['a', 'b', 'c'])).toBe('* a\n* b\n* c\n');
    });

    describe('nested list', () => {
      it('works', () => {
        const markdown = new Markdown();
        expect(markdown.list(['a', 'b', ['c', 'd'], 'e', ['f']])).toBe('- a\n- b\n  - c\n  - d\n- e\n  - f\n');
      });

      it('can set indentation style', () => {
        const markdown = new Markdown({ indentationStyle: TabGroupIndentationStyle.Tab });
        expect(markdown.list(['a', 'b', ['c', 'd'], 'e', ['f']])).toBe('- a\n- b\n\t- c\n\t- d\n- e\n\t- f\n');
      });
    });
  });

  describe('taskList()', () => {
    it('works', () => {
      const markdown = new Markdown();
      expect(markdown.taskList(['a', 'b', 'c'])).toBe('- [ ] a\n- [ ] b\n- [ ] c\n');
    });
  });

  describe('bracketsArePaired()', () => {
    it('cases', () => {
      expect(Markdown.bracketsAreBalanced('[]')).toBe(true);
      expect(Markdown.bracketsAreBalanced('[[]]')).toBe(true);
      expect(Markdown.bracketsAreBalanced('[][]')).toBe(true);
      expect(Markdown.bracketsAreBalanced('][')).toBe(false);
      expect(Markdown.bracketsAreBalanced('[')).toBe(false);
      expect(Markdown.bracketsAreBalanced('[[[')).toBe(false);
      expect(Markdown.bracketsAreBalanced(']')).toBe(false);
      expect(Markdown.bracketsAreBalanced(']]]')).toBe(false);
    });
  });

  describe('escapeLinkText()', () => {
    describe('brackets', () => {
      describe('alwaysEscapeLinkBracket=false', () => {
        const markdown = new Markdown({ alwaysEscapeLinkBracket: false });

        it('escapes unbalanced brackets', () => {
          expect(markdown.escapeLinkText('[[[staples')).toBe('\\[\\[\\[staples');
          expect(markdown.escapeLinkText('staples]]]')).toBe('staples\\]\\]\\]');
          expect(markdown.escapeLinkText('Apple ][')).toBe('Apple \\]\\[');
        });

        it('does not affect balanced brackets', () => {
          expect(markdown.escapeLinkText('[APOLLO-13] Build a Rocket Engine')).toBe('[APOLLO-13] Build a Rocket Engine');
          expect(markdown.escapeLinkText('[[wiki]]')).toBe('[[wiki]]');
        });

        it('does not affect inline image', () => {
          expect(markdown.escapeLinkText('![moon](moon.jpg)')).toBe('![moon](moon.jpg)');
        });
      });

      describe('alwaysEscapeLinkBracket=true', () => {
        const markdown = new Markdown({ alwaysEscapeLinkBracket: true });

        it('escapes unbalanced brackets', () => {
          expect(markdown.escapeLinkText('[[[staples')).toBe('\\[\\[\\[staples');
          expect(markdown.escapeLinkText('staples]]]')).toBe('staples\\]\\]\\]');
          expect(markdown.escapeLinkText('Apple ][')).toBe('Apple \\]\\[');
        });

        it('does not affect balanced brackets', () => {
          expect(markdown.escapeLinkText('[APOLLO-13] Build a Rocket Engine')).toBe('\\[APOLLO-13\\] Build a Rocket Engine');
          expect(markdown.escapeLinkText('[[wiki]]')).toBe('\\[\\[wiki\\]\\]');
        });

        it('does not affect inline image', () => {
          expect(markdown.escapeLinkText('![moon](moon.jpg)')).toBe('!\\[moon\\](moon.jpg)');
        });
      });
    });

    describe('inline formats', () => {
      const markdown = new Markdown({ alwaysEscapeLinkBracket: false });
      it('escapes', () => {
        expect(markdown.escapeLinkText('link *foo **bar** `#`*')).toBe('link \\*foo \\*\\*bar\\*\\* \\`#\\`\\*');
      });
    });
  });

  describe('linkTo() with URL decoding', () => {
    describe('decodeURLs=false (default)', () => {
      const markdown = new Markdown({ decodeURLs: false });

      it('preserves encoded URLs', () => {
        expect(markdown.linkTo('Test', 'https://example.com/%E4%B8%AD%E6%96%87'))
          .toBe('[Test](https://example.com/%E4%B8%AD%E6%96%87)');
      });

      it('preserves already decoded URLs', () => {
        expect(markdown.linkTo('Test', 'https://example.com/中文'))
          .toBe('[Test](https://example.com/中文)');
      });
    });

    describe('decodeURLs=true', () => {
      const markdown = new Markdown({ decodeURLs: true });

      it('decodes URL-encoded Unicode characters', () => {
        expect(markdown.linkTo('Test', 'https://example.com/%E4%B8%AD%E6%96%87'))
          .toBe('[Test](https://example.com/中文)');
      });

      it('keeps spaces encoded for markdown compatibility', () => {
        expect(markdown.linkTo('Test', 'https://example.com/hello%20world'))
          .toBe('[Test](https://example.com/hello%20world)'); // Space remains %20
      });

      it('keeps parentheses encoded for markdown compatibility', () => {
        expect(markdown.linkTo('Test', 'https://example.com/page%28with%29parens'))
          .toBe('[Test](https://example.com/page%28with%29parens)'); // Parentheses remain encoded
      });

      it('decodes query parameters', () => {
        expect(markdown.linkTo('Test', 'https://example.com/search?q=%E4%B8%AD%E6%96%87'))
          .toBe('[Test](https://example.com/search?q=中文)');
      });

      it('passes through already decoded URLs', () => {
        expect(markdown.linkTo('Test', 'https://example.com/中文'))
          .toBe('[Test](https://example.com/中文)');
      });

      it('falls back to original URL on malformed encoding', () => {
        expect(markdown.linkTo('Test', 'https://example.com/%ZZ'))
          .toBe('[Test](https://example.com/%ZZ)');
      });

      it('handles mixed encoded/decoded URLs', () => {
        expect(markdown.linkTo('Test', 'https://example.com/%E4%B8%AD%E6%96%87/decoded'))
          .toBe('[Test](https://example.com/中文/decoded)');
      });
    });
  });
});
