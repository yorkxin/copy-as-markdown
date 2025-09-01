const INDENT_STYLE_SPACES = 'spaces';
const INDENT_STYLE_TAB = 'tab';

/**
 * @typedef {[string] | [string, NestedArray]} NestedArray
 */

/* eslint-disable no-underscore-dangle */
export default class Markdown {
  static DefaultTitle() {
    return '(No Title)';
  }

  /**
   * @param {Object} params
   * @param {boolean} [params.alwaysEscapeLinkBracket]
   * @param {'-'|'*'|'+'} [params.unorderedListChar]
   * @param {'spaces'|'tab'} [params.indentation]
   */
  constructor({
    alwaysEscapeLinkBracket = false,
    unorderedListChar = '-',
    indentation = INDENT_STYLE_SPACES,
  } = {}) {
    this._alwaysEscapeLinkBracket = alwaysEscapeLinkBracket;
    this._unorderedListChar = unorderedListChar;
    this._indentation = indentation;
  }

  /**
   * check if [] are balanced
   * @param text {string}
   * @returns {boolean}
   */
  static bracketsAreBalanced(text) {
    const stack = [];

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
 *
 * @param text {string}
 * @return {string}
 * @see https://spec.commonmark.org/0.30/#link-text
 * @example unbalanced brackets are escaped
 *   escapeLinkText('[[[Staple') // \[\[\[Staple
 *   escapeLinkText('Apple ][') // Apple \]\[
 * @example balanced brackets are intact
 *   escapeLinkText('[JIRA-123] Launch Rocket') // [JIRA-123] Launch Rocket
 * @example inline formats are escaped
 *   escapeLinkText('Click *Start* button to run `launch()`')
 *   //=> Click \*Start\* button to run \`launch()\`
 *
 */
  escapeLinkText(text) {
  // runtime type checking :shrug:
    if (typeof text !== 'string') {
      return '';
    }

    const shouldEscapeBrackets = (
      this.alwaysEscapeLinkBracket // user wants \[\]
      || !Markdown.bracketsAreBalanced(text) // unbalanced brackets, must be escaped
    );

    const newString = [];

    // using an iterator to ensure Unicode code point is considered.
    const it = text[Symbol.iterator]();
    let ch = it.next();

    while (!ch.done) {
      let chToUse = null;

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

  /**
   * Removes URL if present within the title string. If there is a separator
   * before or after the URL (like "title - URL" or "URL - title"), it is also
   * removed.
   *
   * @param {string} title - The title string.
   * @param {string} url - The URL to remove.
   * @returns {string}
   */
  static removeUrlFromTitle(title, url) {
    const urlIndex = title.indexOf(url);
    if (urlIndex === -1) {
      return title;
    }

    // matches whitespace starting at the beginning of the string, followed by
    // 1-2 symbols, followed by whitespace
    const separatorRegex = /^\s+[^\w\s]{1,2}\s+/;

    const beforeUrl = title.substring(0, urlIndex);
    if (beforeUrl.length > 0) {
      const reversed = beforeUrl.split('').reverse().join('');
      const match = reversed.match(separatorRegex);
      if (match) {
        return beforeUrl.substring(0, beforeUrl.length - match[0].length);
      }
      return beforeUrl;
    }

    const afterUrl = title.substring(urlIndex + url.length);
    if (afterUrl.length > 0) {
      const match = afterUrl.match(separatorRegex);
      if (match) {
        return afterUrl.substring(match[0].length);
      }
      return afterUrl;
    }

    return '';
  }

  /**
 * @param {string} title
 * @param {string} url
 */
  linkTo(title, url) {
    let titleToUse = Markdown.removeUrlFromTitle(title, url);
    if (titleToUse === '') {
      titleToUse = Markdown.DefaultTitle();
    } else {
      titleToUse = this.escapeLinkText(titleToUse);
    }
    return `[${titleToUse}](${url})`;
  }

  static imageFor(title, url) {
    return `![${title}](${url})`;
  }

  /**
 *
 * @param description {string}
 * @param url {string}
 * @param linkURL {string}
 * @returns {string}
 */
  static linkedImage(description, url, linkURL) {
    return `[![${description}](${url})](${linkURL})`;
  }

  /**
   * @param {NestedArray} items
   * @returns {string}
   */
  list(items) {
    return this.nestedList(items, this._unorderedListChar);
  }

  /**
   * @param {NestedArray} items
   * @returns {string}
   */
  taskList(items) {
    return this.nestedList(items, '- [ ]');
  }

  /**
   *
   * @param {NestedArray} items
   * @param {string} prefix
   * @param {number} level
   * @return {string}
   */
  nestedList(items, prefix, level = 0) {
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

    return items.map((item) => {
      if (item instanceof Array) {
        return this.nestedList(item, prefix, level + 1);
      }
      return `${renderedIndents}${prefix} ${item}`;
    }).join('\n');
  }

  get alwaysEscapeLinkBracket() {
    return this._alwaysEscapeLinkBracket;
  }

  set alwaysEscapeLinkBracket(value) {
    this._alwaysEscapeLinkBracket = value;
  }

  get unorderedListChar() {
    return this._unorderedListChar;
  }

  set unorderedListChar(value) {
    this._unorderedListChar = value;
  }

  get nestedListIndentation() {
    return this._indentation;
  }

  set nestedListIndentation(value) {
    this._indentation = value;
  }
}

Markdown.INDENT_STYLE_SPACES = INDENT_STYLE_SPACES;
Markdown.INDENT_STYLE_TABS = INDENT_STYLE_TAB;
