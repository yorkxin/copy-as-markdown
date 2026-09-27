export type NestedArray = (string | NestedArray)[];

/** Persisted verbatim and emitted as the unordered-list marker. */
export type BulletListMarker = '-' | '*' | '+';

export const BulletListMarkers: BulletListMarker[] = ['-', '*', '+'];

export function isBulletListMarker(value: unknown): value is BulletListMarker {
  return BulletListMarkers.includes(value as BulletListMarker);
}

export enum TabGroupIndentationStyle {
  Spaces = 'spaces',
  Tab = 'tab',
}

export function isTabGroupIndentationStyle(value: unknown): value is TabGroupIndentationStyle {
  return Object.values(TabGroupIndentationStyle).includes(value as TabGroupIndentationStyle);
}

export default class Markdown {
  alwaysEscapeLinkBracket: boolean;
  bulletListMarker: BulletListMarker;
  indentationStyle: TabGroupIndentationStyle;

  static DefaultTitle(): string {
    return '(No Title)';
  }

  constructor({
    alwaysEscapeLinkBracket = false,
    bulletListMarker = '-' as BulletListMarker,
    indentationStyle = TabGroupIndentationStyle.Spaces,
  } = {}) {
    this.alwaysEscapeLinkBracket = alwaysEscapeLinkBracket;
    this.bulletListMarker = bulletListMarker;
    this.indentationStyle = indentationStyle;
  }

  static bracketsAreBalanced(text: string): boolean {
    const stack: string[] = [];

    // String iteration advances by Unicode code point rather than UTF-16 code unit.
    const it = text[Symbol.iterator]();
    let ch = it.next();

    while (!ch.done) {
      if (ch.value === '[') {
        stack.push(ch.value);
      } else if (ch.value === ']') {
        if (stack.length === 0) {
          return false;
        }
        stack.pop();
      }
      ch = it.next();
    }

    return (stack.length === 0);
  }

  /**
   * Escapes link text to sanitize inline formats or unbalanced brackets.
   * @see https://spec.commonmark.org/0.30/#link-text
   * @example unbalanced brackets are escaped
   *   escapeLinkText('[[[Staple') // \[\[\[Staple
   *   escapeLinkText('Apple ][') // Apple \]\[
   * @example balanced brackets are intact
   *   escapeLinkText('[JIRA-123] Launch Rocket') // [JIRA-123] Launch Rocket
   * @example inline formats are escaped
   *   escapeLinkText('Click *Start* button to run `launch()`')
   *   //=> Click \*Start\* button to run \`launch()\`
   */
  escapeLinkText(text: string): string {
    const shouldEscapeBrackets = (
      this.alwaysEscapeLinkBracket // user wants \[\]
      || !Markdown.bracketsAreBalanced(text) // unbalanced brackets, must be escaped
    );

    const newString: string[] = [];

    // String iteration advances by Unicode code point rather than UTF-16 code unit.
    const it = text[Symbol.iterator]();
    let ch = it.next();

    while (!ch.done) {
      let chToUse: string | null = null;

      switch (ch.value) {
        case '[':
        case ']':
          if (shouldEscapeBrackets) {
            chToUse = `\\${ch.value}`;
          }
          break;

        case '*':
        case '_':
        case '`':
        case '~':
          chToUse = `\\${ch.value}`;
          break;

        default:
          break;
      }

      if (chToUse === null) {
        chToUse = ch.value;
      }

      newString.push(chToUse);
      ch = it.next();
    }

    return newString.join('');
  }

  linkTo(title: string, url: string): string {
    let titleToUse: string;
    if (title === '') {
      titleToUse = Markdown.DefaultTitle();
    } else {
      titleToUse = this.escapeLinkText(title);
    }
    return `[${titleToUse}](${url})`;
  }

  static imageFor(title: string, url: string): string {
    return `![${title}](${url})`;
  }

  static linkedImage(description: string, url: string, linkURL: string): string {
    return `[![${description}](${url})](${linkURL})`;
  }

  list(items: NestedArray): string {
    const rendered = this.renderList(items, this.bulletListMarker);
    const flattened = rendered.flat(10);
    return flattened.map(item => `${item}\n`).join('');
  }

  taskList(items: NestedArray): string {
    const rendered = this.renderList(items, '- [ ]');
    const flattened = rendered.flat(10);
    return flattened.map(item => `${item}\n`).join('');
  }

  renderList(items: NestedArray, prefix: string, level: number = 0): NestedArray {
    let renderedIndents = '';
    let indent = '';
    if (this.indentationStyle === TabGroupIndentationStyle.Spaces) {
      // Ordered lists would need indentation based on the parent marker's width.
      indent = '  ';
    } else if (this.indentationStyle === TabGroupIndentationStyle.Tab) {
      indent = '\t';
    } else {
      throw new TypeError(`Invalid indent style ${this.indentationStyle}`);
    }

    for (let i = 0; i < level; i += 1) {
      renderedIndents += indent;
    }

    return items.map((item: string | NestedArray) => {
      if (Array.isArray(item)) {
        return this.renderList(item, prefix, level + 1);
      }
      return `${renderedIndents}${prefix} ${item}`;
    });
  }
}
