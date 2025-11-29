import { expect, test } from '../fixtures';
import {
  triggerContextMenu,
  waitForMockClipboard,
} from '../helpers';

// NOTE: Bookmarks context menu is only available on Firefox;
// such context menu is not available on Chrome.
// But since we're emulating context menu events by emitting an event
// we can do e2e test for the event handler by emitting a fake event in Chrome.
test.describe('bookmarks', () => {
  let bookmarkId: string | undefined;

  test.beforeEach(async ({ serviceWorker }) => {
    bookmarkId = await serviceWorker.evaluate(async () => {
      const [root] = await chrome.bookmarks.getTree();
      const parentId = root.children?.find(child => !child.url)?.id ?? root.id;

      const created = await chrome.bookmarks.create({
        parentId,
        title: 'QA Bookmark',
        url: 'https://example.com/bookmark',
      });

      return created.id;
    });
  });

  test.afterEach(async ({ serviceWorker }) => {
    if (bookmarkId) {
      await serviceWorker.evaluate(async (id) => {
        try {
          await chrome.bookmarks.remove(id);
        } catch {
          // best-effort cleanup
        }
      }, bookmarkId);
    }
  });

  test.describe('context menu', () => {
    test('copies bookmark as markdown', async ({ serviceWorker }) => {
      await triggerContextMenu(serviceWorker, 'bookmark-link', {
        bookmarkId,
      });

      const clipboardText = (await waitForMockClipboard(serviceWorker)).text;
      expect(clipboardText).toBe('[QA Bookmark](https://example.com/bookmark)');
    });

    test('copies nested bookmark folder as markdown list', async ({ serviceWorker }) => {
      let folderId: string | undefined;

      try {
        folderId = await serviceWorker.evaluate(async () => {
          const [root] = await chrome.bookmarks.getTree();
          const parentId = root.children?.find(child => !child.url)?.id ?? root.id;

          const parentFolder = await chrome.bookmarks.create({
            parentId,
            title: 'Parent Folder',
          });

          const childFolder = await chrome.bookmarks.create({
            parentId: parentFolder.id,
            title: 'Child Folder',
          });

          await chrome.bookmarks.create({
            parentId: childFolder.id,
            title: 'Nested Link',
            url: 'https://example.com/nested',
          });

          return parentFolder.id;
        });

        await triggerContextMenu(serviceWorker, 'bookmark-link', {
          bookmarkId: folderId,
        });

        const clipboardText = (await waitForMockClipboard(serviceWorker)).text;
        expect(clipboardText).toBe(
          '- Parent Folder\n'
          + '    - Child Folder\n'
          + '        - [Nested Link](https://example.com/nested)\n',
        );
      } finally {
        if (folderId) {
          await serviceWorker.evaluate(async (id) => {
            try {
              await chrome.bookmarks.removeTree(id);
            } catch {
            // best-effort cleanup
            }
          }, folderId);
        }
      }
    });
  });
});
