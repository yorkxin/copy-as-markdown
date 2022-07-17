/* eslint-disable no-underscore-dangle */
export default class Markdown {
  static DefaultTitle() {
    return '(No Title)';
  }

  constructor({ alwaysEscapeLinkBracket }) {
    this._alwaysEscapeLinkBracket = alwaysEscapeLinkBracket || false;
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
      || !this.constructor.bracketsAreBalanced(text) // unbalanced brackets, must be escaped
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
 * @param {string} title
 * @param {string} url
 */
  linkTo(title, url) {
    let titleToUse;
    if (title === '') {
      titleToUse = this.constructor.DefaultTitle();
    } else {
      titleToUse = this.escapeLinkText(title);
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

  static list(theList) {
    return theList.map((item) => `* ${item}`).join('\n');
  }

  links(theLinks) {
    return this.constructor.list(theLinks.map((link) => this.linkTo(link.title, link.url)));
  }

  get alwaysEscapeLinkBracket() {
    return this._alwaysEscapeLinkBracket;
  }

  set alwaysEscapeLinkBracket(value) {
    this._alwaysEscapeLinkBracket = value;
  }
}
