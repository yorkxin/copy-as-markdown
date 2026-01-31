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
  decodeURLs: boolean;

  static DefaultTitle(): string {
    return '(No Title)';
  }

  constructor({
    alwaysEscapeLinkBracket = false,
    unorderedListStyle = UnorderedListStyle.Dash,
    indentationStyle = TabGroupIndentationStyle.Spaces,
    decodeURLs = false,
  } = {}) {
    this.alwaysEscapeLinkBracket = alwaysEscapeLinkBracket;
    this.unorderedListStyle = unorderedListStyle;
    this.indentationStyle = indentationStyle;
    this.decodeURLs = decodeURLs;
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

    let urlToUse = url;
    if (this.decodeURLs) {
      try {
        // Decode the entire URL for readability
        urlToUse = decodeURI(url);

        // Re-encode characters that break markdown URL syntax
        // Space and parentheses need to remain encoded to maintain markdown compatibility
        // Space (%20) terminates the URL in some markdown parsers
        // Closing parenthesis (%29) would prematurely end the URL in markdown [title](url)
        urlToUse = urlToUse.replace(/[ ()]/g, (char) => {
          switch (char) {
            case ' ': return '%20';
            case '(': return '%28';
            case ')': return '%29';
            default: return char;
          }
        });
      } catch (error) {
        // Fall back to original URL if decoding fails
        console.warn('Failed to decode URL:', url, error);
      }
    }

    return `[${titleToUse}](${urlToUse})`;
  }

  static imageFor(title: string, url: string): string {
    return `![${title}](${url})`;
  }

  static linkedImage(description: string, url: string, linkURL: string): string {
    return `[![${description}](${url})](${linkURL})`;
  }

  list(items: NestedArray): string {
    const rendered = this.renderList(items, this.unorderedListChar);
    const flattened = rendered.flat(10); // otherwise it only flatters 1 level deep
    return flattened.map(item => `${item}\n`).join('');
  }

  taskList(items: NestedArray): string {
    const rendered = this.renderList(items, '- [ ]');
    const flattened = rendered.flat(10); // otherwise it only flatters 1 level deep
    return flattened.map(item => `${item}\n`).join('');
  }

  renderList(items: NestedArray, prefix: string, level: number = 0): NestedArray {
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
        return this.renderList(item, prefix, level + 1);
      }
      return `${renderedIndents}${prefix} ${item}`;
    });
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
