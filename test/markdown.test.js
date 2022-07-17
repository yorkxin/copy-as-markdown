import * as assert from 'assert';
import Markdown from '../src/lib/markdown.js';

describe('Markdown', () => {
  it('default properties', () => {
    const markdown = new Markdown({});
    assert.equal(markdown.alwaysEscapeLinkBracket, false);
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
