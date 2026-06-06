/**
 * This function executes in the content script context.
 * It must be self-contained - no external function calls.
 *
 * NOTE: This function should be executed in a content script. It extracts the
 * current selection as an HTML fragment; the HTML→Markdown conversion happens
 * elsewhere (offscreen document on Chrome / Event Page on Firefox).
 */
export function extractSelectionHtml(onlyIfFocused: boolean): string {
  // When triggered without a precise frame (keyboard shortcut), this function runs in
  // every frame. Only the frame the user is actually in should contribute text. A frame
  // is the focused leaf when the document has focus AND its active element is not a nested
  // frame (ancestors of the focused frame report hasFocus() too, but their activeElement is
  // the child frame element). Background iframes that auto-select text do not have focus.
  if (onlyIfFocused) {
    const active = document.activeElement;
    // HTMLFrameElement is the legacy <frame> (framesets); kept for completeness even
    // though modern pages only use <iframe>.
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

  // Fix <a href> so that they are absolute URLs
  container.querySelectorAll('a').forEach((value) => {
    value.setAttribute('href', value.href);
  });

  // Fix <img src> so that they are absolute URLs
  container.querySelectorAll('img').forEach((value) => {
    value.setAttribute('src', value.src);
  });

  // Normalize wrapped PRE blocks into canonical <pre><code>...</code></pre>.
  // This keeps matching conservative and delegates markdown rendering details
  // (fenced vs indented, language handling, fence sizing) to Turndown built-ins.
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

    // Conservative matcher: avoid rewriting instructional <pre> content.
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
