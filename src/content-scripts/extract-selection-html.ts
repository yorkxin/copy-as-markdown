/**
 * Serialized into page frames, so it cannot reference other module members.
 * HTML-to-Markdown conversion happens outside the page.
 */
export function extractSelectionHtml(onlyIfFocused: boolean): string {
  // Keyboard shortcuts inject into every frame. Ancestors of the focused frame also
  // report hasFocus(), but their active element is the child frame, leaving one focused leaf.
  if (onlyIfFocused) {
    const active = document.activeElement;
    // HTMLFrameElement covers legacy framesets in addition to modern iframes.
    const activeIsSubFrame
      = active instanceof HTMLIFrameElement || active instanceof HTMLFrameElement;
    if (!document.hasFocus() || activeIsSubFrame) {
      return '';
    }
  }

  const sel = getSelection();
  if (!sel) {
    return '';
  }

  const container = document.createElement('div');
  for (let i = 0, len = sel.rangeCount; i < len; i += 1) {
    container.appendChild(sel.getRangeAt(i).cloneContents());
  }

  // Reading .href/.src resolves relative URLs against the page; writing them back
  // preserves absolute URLs after the fragment leaves that page.
  container.querySelectorAll('a').forEach((value) => {
    value.setAttribute('href', value.href);
  });

  container.querySelectorAll('img').forEach((value) => {
    value.setAttribute('src', value.src);
  });

  // Canonical <pre><code> markup delegates fence style, language, and sizing to Turndown.
  container.querySelectorAll('pre').forEach((pre) => {
    if (pre.firstElementChild?.nodeName === 'CODE') {
      return;
    }

    const codeNodes = pre.querySelectorAll('code');
    if (codeNodes.length !== 1) {
      return;
    }

    const codeNode = codeNodes[0]!;
    const className = codeNode.getAttribute('class') || '';
    const hasLanguageClass = /\blanguage-\S+\b/.test(className);
    const codeText = codeNode.textContent || '';
    const hasMultilineCode = codeText.includes('\n');

    // Single-line, unclassified <pre> elements may be instructional text rather than code.
    if (!hasLanguageClass && !hasMultilineCode) {
      return;
    }

    const normalizedCode = document.createElement('code');
    if (className) {
      normalizedCode.setAttribute('class', className);
    }
    normalizedCode.textContent = codeText;
    pre.replaceChildren(normalizedCode);
  });

  return container.innerHTML;
}
