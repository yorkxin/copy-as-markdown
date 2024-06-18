import { describe, it } from 'node:test';
import * as assert from 'assert';
import Markdown from '../src/lib/markdown.js';

describe('Markdown', () => {
  it('default properties', () => {
    const markdown = new Markdown({});
    assert.equal(markdown.alwaysEscapeLinkBracket, false);
  });

  describe('list()', () => {
    it('defaults to dash', () => {
      const markdown = new Markdown();
      assert.equal(markdown.list(['a', 'b', 'c']), '- a\n- b\n- c');
    });

    it('can set a character', () => {
      const markdown = new Markdown({ unorderedListChar: '*' });
      assert.equal(markdown.list(['a', 'b', 'c']), '* a\n* b\n* c');
    });

    describe('nested list', () => {
      it('works', () => {
        const markdown = new Markdown();
        assert.equal(markdown.list(['a', 'b', ['c', 'd'], 'e', ['f']]), '- a\n- b\n  - c\n  - d\n- e\n  - f');
      });

      it('can set indentation style', () => {
        const markdown = new Markdown({ indentation: Markdown.INDENT_STYLE_TABS });
        assert.equal(markdown.list(['a', 'b', ['c', 'd'], 'e', ['f']]), '- a\n- b\n\t- c\n\t- d\n- e\n\t- f');
      });
    });
  });

  describe('taskList()', () => {
    it('works', () => {
      const markdown = new Markdown();
      assert.equal(markdown.taskList(['a', 'b', 'c']), '- [ ] a\n- [ ] b\n- [ ] c');
    });
  });

  describe('bracketsArePaired()', () => {
    it('cases', () => {
      assert.equal(Markdown.bracketsAreBalanced('[]'), true);
      assert.equal(Markdown.bracketsAreBalanced('[[]]'), true);
      assert.equal(Markdown.bracketsAreBalanced('[][]'), true);
      assert.equal(Markdown.bracketsAreBalanced(']['), false);
      assert.equal(Markdown.bracketsAreBalanced('['), false);
      assert.equal(Markdown.bracketsAreBalanced('[[['), false);
      assert.equal(Markdown.bracketsAreBalanced(']'), false);
      assert.equal(Markdown.bracketsAreBalanced(']]]'), false);
    });
  });

  describe('escapeLinkText()', () => {
    describe('brackets', () => {
      describe('alwaysEscapeLinkBracket=false', () => {
        const markdown = new Markdown({ alwaysEscapeLinkBracket: false });

        it('escapes unbalanced brackets', () => {
          assert.equal(markdown.escapeLinkText('[[[staples'), '\\[\\[\\[staples');
          assert.equal(markdown.escapeLinkText('staples]]]'), 'staples\\]\\]\\]');
          assert.equal(markdown.escapeLinkText('Apple ]['), 'Apple \\]\\[');
        });

        it('does not affect balanced brackets', () => {
          assert.equal(markdown.escapeLinkText('[APOLLO-13] Build a Rocket Engine'), '[APOLLO-13] Build a Rocket Engine');
          assert.equal(markdown.escapeLinkText('[[wiki]]'), '[[wiki]]');
        });

        it('does not affect inline image', () => {
          assert.equal(markdown.escapeLinkText('![moon](moon.jpg)'), '![moon](moon.jpg)');
        });
      });

      describe('alwaysEscapeLinkBracket=true', () => {
        const markdown = new Markdown({ alwaysEscapeLinkBracket: true });

        it('escapes unbalanced brackets', () => {
          assert.equal(markdown.escapeLinkText('[[[staples'), '\\[\\[\\[staples');
          assert.equal(markdown.escapeLinkText('staples]]]'), 'staples\\]\\]\\]');
          assert.equal(markdown.escapeLinkText('Apple ]['), 'Apple \\]\\[');
        });

        it('does not affect balanced brackets', () => {
          assert.equal(markdown.escapeLinkText('[APOLLO-13] Build a Rocket Engine'), '\\[APOLLO-13\\] Build a Rocket Engine');
          assert.equal(markdown.escapeLinkText('[[wiki]]'), '\\[\\[wiki\\]\\]');
        });

        it('does not affect inline image', () => {
          assert.equal(markdown.escapeLinkText('![moon](moon.jpg)'), '!\\[moon\\](moon.jpg)');
        });
      });
    });

    describe('inline formats', () => {
      const markdown = new Markdown({ alwaysEscapeLinkBracket: false });
      it('escapes', () => {
        assert.equal(markdown.escapeLinkText('link *foo **bar** `#`*'), 'link \\*foo \\*\\*bar\\*\\* \\`#\\`\\*');
      });
    });
  });
});
