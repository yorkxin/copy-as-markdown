import { describe, it } from 'node:test';
import * as assert from 'assert';
import Markdown from '../src/lib/markdown.js';
import { Bookmarks } from '../src/bookmarks.js';

describe('bookmarks.js', () => {
  describe('toMarkdown', () => {
    const md = new Markdown();
    const bm = new Bookmarks({
      markdown: md,
      webExtBookmarks: { },
    });

    it('works for one item', () => {
      const node = {
        id: 'foo1',
        title: 'foo',
        url: 'https://example.com',
      };

      const actual = bm.toMarkdown(node);
      assert.equal(actual, '[foo](https://example.com)');
    });

    it('works for a folder', () => {
      const node = {
        id: 'foo1',
        title: 'foo 1',
        children: [
          {
            id: 'bar1',
            title: 'bar 1',
            url: 'http://example.com/1',
          },
          {
            id: 'bar2',
            title: 'bar 2',
            url: 'http://example.com/2',
          },
          {
            id: 'bar3',
            title: 'bar 3',
            children: [
              {
                id: 'baz1',
                title: 'baz 1',
                url: 'http://baz.com/1',
              },
            ],
          },
          {
            id: 'bar4',
            title: 'bar 4',
            children: [
            ],
          },
          {
            id: 'bar5',
            title: 'bar 5',
          },
        ],
      };

      const actual = bm.toMarkdown(node);
      assert.equal(
        actual,
        '- foo 1\n'
        + '    - [bar 1](http://example.com/1)\n'
        + '    - [bar 2](http://example.com/2)\n'
        + '    - bar 3\n'
        + '        - [baz 1](http://baz.com/1)\n'
        + '    - bar 4\n'
        + '    - bar 5'
        ,
      );
    });
  });
});
