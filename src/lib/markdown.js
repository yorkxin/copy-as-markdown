const DEFAULT_TITLE = '(No Title)';

/**
 * check if [] are balanced
 * @param text {string}
 * @returns {boolean}
 */
export function bracketsAreBalanced(text) {
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
export function escapeLinkText(text) {
  const shouldEscapeBrackets = !bracketsAreBalanced(text);

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
export function linkTo(title, url) {
  let titleToUse;
  if (title === '') {
    titleToUse = DEFAULT_TITLE;
  } else {
    titleToUse = escapeLinkText(title);
  }
  return `[${titleToUse}](${url})`;
}

export function imageFor(title, url) {
  return `![${title}](${url})`;
}

export function list(theList) {
  return theList.map((item) => `* ${item}`).join('\n');
}

export function links(theLinks) {
  return list(theLinks.map((link) => linkTo(link.title, link.url)));
}
