import { describe, test } from 'node:test';
import * as assert from 'node:assert';
import { Tab, TabList } from '../src/lib/tabs.js';
import CustomFormat from '../src/lib/custom-format.js';

describe('custom-format.js', () => {
  describe('makeRenderInput', () => {
    test('ungrouped', () => {
      /** @type TabList[] */
      const lists = [
        new TabList('', -1, [
          new Tab('Example 1', 'https://example.com/1', -1),
          new Tab('Example 2', 'https://example.com/2', -1),
          new Tab('Example 3', 'https://example.com/3', -1),
        ]),
      ];

      const actual = CustomFormat.makeRenderInput(lists);
      assert.deepEqual(actual, {
        links: [
          { title: 'Example 1', url: 'https://example.com/1', number: 1 },
          { title: 'Example 2', url: 'https://example.com/2', number: 2 },
          { title: 'Example 3', url: 'https://example.com/3', number: 3 },
        ],
        groups: [
          {
            name: '',
            is_ungrouped: true,
            number: 1,
            links: [
              { title: 'Example 1', url: 'https://example.com/1', number: 1 },
              { title: 'Example 2', url: 'https://example.com/2', number: 2 },
              { title: 'Example 3', url: 'https://example.com/3', number: 3 },
            ],
          },
        ],
      });
    });

    test('one group', () => {
      /** @type TabList[] */
      const lists = [
        new TabList('', -1, [
          new Tab('Example 1', 'https://example.com/1', -1),
        ]),
        new TabList('My Group', 42, [
          new Tab('Example 2', 'https://example.com/2', 42),
          new Tab('Example 3', 'https://example.com/3', 42),
        ]),
        new TabList('', -1, [
          new Tab('Example 4', 'https://example.com/4', -1),
        ]),
      ];

      const actual = CustomFormat.makeRenderInput(lists);
      assert.deepEqual(actual, {
        links: [
          { title: 'Example 1', url: 'https://example.com/1', number: 1 },
          { title: 'Example 2', url: 'https://example.com/2', number: 2 },
          { title: 'Example 3', url: 'https://example.com/3', number: 3 },
          { title: 'Example 4', url: 'https://example.com/4', number: 4 },
        ],
        groups: [
          {
            name: '',
            is_ungrouped: true,
            number: 1,
            links: [
              { title: 'Example 1', url: 'https://example.com/1', number: 1 },
            ],
          },
          {
            name: 'My Group',
            is_ungrouped: false,
            number: 2,
            links: [
              { title: 'Example 2', url: 'https://example.com/2', number: 1 },
              { title: 'Example 3', url: 'https://example.com/3', number: 2 },
            ],
          },
          {
            name: '',
            is_ungrouped: true,
            number: 3,
            links: [
              { title: 'Example 4', url: 'https://example.com/4', number: 1 },
            ],
          },
        ],
      });
    });
  });
});
