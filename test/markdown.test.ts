import { afterEach, describe, expect, it, vi } from 'vitest';
import Markdown, { TabGroupIndentationStyle, UnorderedListStyle } from '../src/lib/markdown';

describe('markdown', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('default properties', () => {
    const markdown = new Markdown({});
    expect(markdown.alwaysEscapeLinkBracket).toBe(false);
  });

  describe('list()', () => {
    it('defaults to dash', () => {
      const markdown = new Markdown();
      expect(markdown.list(['a', 'b', 'c'])).toBe('- a\n- b\n- c');
    });

    it('can set a character', () => {
      const markdown = new Markdown({ unorderedListStyle: UnorderedListStyle.Asterisk });
      expect(markdown.list(['a', 'b', 'c'])).toBe('* a\n* b\n* c');
    });

    describe('nested list', () => {
      it('works', () => {
        const markdown = new Markdown();
        expect(markdown.list(['a', 'b', ['c', 'd'], 'e', ['f']])).toBe('- a\n- b\n  - c\n  - d\n- e\n  - f');
      });

      it('can set indentation style', () => {
        const markdown = new Markdown({ indentationStyle: TabGroupIndentationStyle.Tab });
        expect(markdown.list(['a', 'b', ['c', 'd'], 'e', ['f']])).toBe('- a\n- b\n\t- c\n\t- d\n- e\n\t- f');
      });
    });
  });

  describe('taskList()', () => {
    it('works', () => {
      const markdown = new Markdown();
      expect(markdown.taskList(['a', 'b', 'c'])).toBe('- [ ] a\n- [ ] b\n- [ ] c');
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
});
