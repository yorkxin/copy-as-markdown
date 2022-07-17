import * as assert from 'assert';
import * as Markdown from '../src/lib/markdown.js';

describe('Markdown', () => {
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
      it('escapes unbalanced brackets', () => {
        assert.equal(Markdown.escapeLinkText('[[[staples'), '\\[\\[\\[staples');
        assert.equal(Markdown.escapeLinkText('staples]]]'), 'staples\\]\\]\\]');
        assert.equal(Markdown.escapeLinkText('Apple ]['), 'Apple \\]\\[');
      });

      it('does not affect balanced brackets', () => {
        assert.equal(Markdown.escapeLinkText('[APOLLO-13] Build a Rocket Engine'), '[APOLLO-13] Build a Rocket Engine');
        assert.equal(Markdown.escapeLinkText('[[[wiki]]]'), '[[[wiki]]]');
      });

      it('does not affect inline image', () => {
        assert.equal(Markdown.escapeLinkText('![moon](moon.jpg)'), '![moon](moon.jpg)');
      });
    });

    describe('inline formats', () => {
      it('escapes', () => {
        assert.equal(Markdown.escapeLinkText('link *foo **bar** `#`*'), 'link \\*foo \\*\\*bar\\*\\* \\`#\\`\\*');
      });
    });
  });
});
