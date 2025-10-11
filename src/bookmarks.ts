import type Markdown from './lib/markdown';
import type { NestedArray } from './lib/markdown';

/**
 * Bookmarks handles bookmarks formatting
 */
export class Bookmarks {
  private _markdown: Markdown;

  constructor({ markdown }: { markdown: Markdown }) {
    this._markdown = markdown;
  }

  aggregate(bookmark: browser.bookmarks.BookmarkTreeNode): NestedArray {
    if (bookmark.url) {
      // an actual bookmark, not a folder, return
      return [this._markdown.linkTo(bookmark.title, bookmark.url)];
    }

    // it is a folder, for sure

    // empty folder
    if (typeof bookmark.children === 'undefined') {
      return [bookmark.title];
    }

    // folder, traverse
    const children = bookmark.children.map((bm) => this.aggregate(bm));
    if (children.length === 0) {
      return [bookmark.title];
    }
    return [bookmark.title, children];
  }

  toMarkdown(bookmark: browser.bookmarks.BookmarkTreeNode): string {
    const tree = this.aggregate(bookmark);

    if (tree.length === 1) {
      return tree[0] as string;
    }

    return this._markdown.list(tree);
  }
}
