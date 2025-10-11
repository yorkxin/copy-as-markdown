const INDENT_STYLE_SPACES = 'spaces';
const INDENT_STYLE_TAB = 'tab';

export type NestedArray = (string | NestedArray)[];

export default class Markdown {
  private _alwaysEscapeLinkBracket: boolean;
  private _unorderedListChar: '-' | '*' | '+';
  private _indentation: 'spaces' | 'tab';

  static INDENT_STYLE_SPACES = INDENT_STYLE_SPACES;
  static INDENT_STYLE_TABS = INDENT_STYLE_TAB;

  static DefaultTitle(): string {
    return '(No Title)';
  }

  constructor({
    alwaysEscapeLinkBracket = false,
    unorderedListChar = '-' as '-' | '*' | '+',
    indentation = INDENT_STYLE_SPACES as 'spaces' | 'tab',
  } = {}) {
    this._alwaysEscapeLinkBracket = alwaysEscapeLinkBracket;
    this._unorderedListChar = unorderedListChar;
    this._indentation = indentation;
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
   */
  escapeLinkText(text: string): string {
    // runtime type checking
    if (typeof text !== 'string') {
      return '';
    }

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
    return this.nestedList(items, this._unorderedListChar);
  }

  taskList(items: NestedArray): string {
    return this.nestedList(items, '- [ ]');
  }

  nestedList(items: NestedArray, prefix: string, level: number = 0): string {
    let renderedIndents = '';
    let indent = '';
    if (this._indentation === INDENT_STYLE_SPACES) {
      // Two spaces, happens to work because we only support unordered list.
      // It will break if we are going to support ordered list, in which the spaces to use
      // depend on the length of prefix characters in the parent level.
      indent = '  ';
    } else if (this._indentation === INDENT_STYLE_TAB) {
      indent = '\t';
    } else {
      throw new TypeError(`Invalid indent style ${this._indentation}`);
    }

    for (let i = 0; i < level; i += 1) {
      renderedIndents += indent;
    }

    return items.map((item: string | NestedArray) => {
      if (item instanceof Array) {
        return this.nestedList(item, prefix, level + 1);
      }
      return `${renderedIndents}${prefix} ${item}`;
    }).join('\n');
  }

  get alwaysEscapeLinkBracket(): boolean {
    return this._alwaysEscapeLinkBracket;
  }

  set alwaysEscapeLinkBracket(value: boolean) {
    this._alwaysEscapeLinkBracket = value;
  }

  get unorderedListChar(): '-' | '*' | '+' {
    return this._unorderedListChar;
  }

  set unorderedListChar(value: '-' | '*' | '+') {
    this._unorderedListChar = value;
  }

  get nestedListIndentation(): 'spaces' | 'tab' {
    return this._indentation;
  }

  set nestedListIndentation(value: 'spaces' | 'tab') {
    this._indentation = value;
  }
}
