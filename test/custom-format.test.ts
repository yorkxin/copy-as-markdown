import { describe, test } from 'node:test';
import * as assert from 'node:assert';
import { Tab, TabList } from '../src/lib/tabs';
import CustomFormat from '../src/lib/custom-format';

describe('custom-format.js', () => {
  describe('makeRenderInput', () => {
    test('ungrouped', () => {
      const lists: TabList[] = [
        new TabList('', -1, [
          new Tab('Example 1', 'https://example.com/1', -1),
          new Tab('Example 2', 'https://example.com/2', -1),
          new Tab('Example 3', 'https://example.com/3', -1),
        ]),
      ];

      const actual = CustomFormat.makeRenderInputForTabLists(lists);
      assert.deepEqual(actual, {
        links: [
          { title: 'Example 1', url: 'https://example.com/1', number: 1 },
          { title: 'Example 2', url: 'https://example.com/2', number: 2 },
          { title: 'Example 3', url: 'https://example.com/3', number: 3 },
        ],
        grouped: [
          {
            title: 'Example 1', url: 'https://example.com/1', number: 1, isGroup: false, links: [],
          },
          {
            title: 'Example 2', url: 'https://example.com/2', number: 2, isGroup: false, links: [],
          },
          {
            title: 'Example 3', url: 'https://example.com/3', number: 3, isGroup: false, links: [],
          },
        ],
      });
    });

    test('a group in the middle', () => {
      const lists: TabList[] = [
        new TabList('', -1, [
          new Tab('Example 1', 'https://example.com/1', -1),
          new Tab('Example 2', 'https://example.com/2', -1),
        ]),
        new TabList('My Group', 42, [
          new Tab('Example 3', 'https://example.com/3', 42),
          new Tab('Example 4', 'https://example.com/4', 42),
        ]),
        new TabList('', -1, [
          new Tab('Example 5', 'https://example.com/5', -1),
          new Tab('Example 6', 'https://example.com/6', -1),
        ]),
      ];

      const actual = CustomFormat.makeRenderInputForTabLists(lists);
      assert.deepEqual(actual, {
        links: [
          { title: 'Example 1', url: 'https://example.com/1', number: 1 },
          { title: 'Example 2', url: 'https://example.com/2', number: 2 },
          { title: 'Example 3', url: 'https://example.com/3', number: 3 },
          { title: 'Example 4', url: 'https://example.com/4', number: 4 },
          { title: 'Example 5', url: 'https://example.com/5', number: 5 },
          { title: 'Example 6', url: 'https://example.com/6', number: 6 },
        ],
        grouped: [
          {
            title: 'Example 1', url: 'https://example.com/1', number: 1, isGroup: false, links: [],
          },
          {
            title: 'Example 2', url: 'https://example.com/2', number: 2, isGroup: false, links: [],
          },
          {
            isGroup: true,
            title: 'My Group',
            url: null,
            number: 3,
            links: [
              {
                title: 'Example 3', url: 'https://example.com/3', number: 1, isGroup: false, links: [],
              },
              {
                title: 'Example 4', url: 'https://example.com/4', number: 2, isGroup: false, links: [],
              },
            ],
          },
          {
            title: 'Example 5', url: 'https://example.com/5', number: 4, isGroup: false, links: [],
          },
          {
            title: 'Example 6', url: 'https://example.com/6', number: 5, isGroup: false, links: [],
          },
        ],
      });
    });

    test('a group at the end', () => {
      const lists: TabList[] = [
        new TabList('', -1, [
          new Tab('Example 1', 'https://example.com/1', -1),
          new Tab('Example 2', 'https://example.com/2', -1),
        ]),
        new TabList('My Group', 42, [
          new Tab('Example 3', 'https://example.com/3', 42),
          new Tab('Example 4', 'https://example.com/4', 42),
        ]),
      ];

      const actual = CustomFormat.makeRenderInputForTabLists(lists);
      assert.deepEqual(actual, {
        links: [
          { title: 'Example 1', url: 'https://example.com/1', number: 1 },
          { title: 'Example 2', url: 'https://example.com/2', number: 2 },
          { title: 'Example 3', url: 'https://example.com/3', number: 3 },
          { title: 'Example 4', url: 'https://example.com/4', number: 4 },
        ],
        grouped: [
          {
            title: 'Example 1', url: 'https://example.com/1', number: 1, isGroup: false, links: [],
          },
          {
            title: 'Example 2', url: 'https://example.com/2', number: 2, isGroup: false, links: [],
          },
          {
            isGroup: true,
            title: 'My Group',
            url: null,
            number: 3,
            links: [
              {
                title: 'Example 3', url: 'https://example.com/3', number: 1, isGroup: false, links: [],
              },
              {
                title: 'Example 4', url: 'https://example.com/4', number: 2, isGroup: false, links: [],
              },
            ],
          },
        ],
      });
    });
  });
});
