export type NestedArray = (string | NestedArray)[];

export enum UnorderedListStyle {
  Dash = 'dash',
  Asterisk = 'asterisk',
  Plus = 'plus',
}

export enum TabGroupIndentationStyle {
  Spaces = 'spaces',
  Tab = 'tab',
}

export default class Markdown {
  alwaysEscapeLinkBracket: boolean;
  unorderedListStyle: UnorderedListStyle;
  indentationStyle: TabGroupIndentationStyle;

  static DefaultTitle(): string {
    return '(No Title)';
  }

  constructor({
    alwaysEscapeLinkBracket = false,
    unorderedListStyle = UnorderedListStyle.Dash,
    indentationStyle = TabGroupIndentationStyle.Spaces,
  } = {}) {
    this.alwaysEscapeLinkBracket = alwaysEscapeLinkBracket;
    this.unorderedListStyle = unorderedListStyle;
    this.indentationStyle = indentationStyle;
  }

  /**
   * check if [] are balanced
   */
  static bracketsAreBalanced(text: string): boolean {
    const stack: string[] = [];

    // using an iterator to ensure Unicode code point is considered.
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

    // using an iterator to ensure Unicode code point is considered.
    const it = text[Symbol.iterator]();
    let ch = it.next();

    while (!ch.done) {
      let chToUse: string | null = null;

      switch (ch.value) {
        // Potential unbalanced brackets
        case '[':
        case ']':
          if (shouldEscapeBrackets) {
            chToUse = `\\${ch.value}`;
          }
          break;

        // chars that may be interpreted as inline formats
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
    return this.nestedList(items, this.unorderedListChar);
  }

  taskList(items: NestedArray): string {
    return this.nestedList(items, '- [ ]');
  }

  nestedList(items: NestedArray, prefix: string, level: number = 0): string {
    let renderedIndents = '';
    let indent = '';
    if (this.indentationStyle === TabGroupIndentationStyle.Spaces) {
      // Two spaces, happens to work because we only support unordered list.
      // It will break if we are going to support ordered list, in which the spaces to use
      // depend on the length of prefix characters in the parent level.
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
        return this.nestedList(item, prefix, level + 1);
      }
      return `${renderedIndents}${prefix} ${item}`;
    }).join('\n');
  }

  get unorderedListChar(): '-' | '*' | '+' {
    switch (this.unorderedListStyle) {
      case UnorderedListStyle.Asterisk:
        return '*';
      case UnorderedListStyle.Dash:
        return '-';
      case UnorderedListStyle.Plus:
        return '+';
      default:
        throw new TypeError(`invalid unorderedListStyle: ${this.unorderedListStyle}`);
    }
  }
}
