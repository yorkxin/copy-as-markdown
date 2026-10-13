// Removes web-chat export boilerplate (copy/share/feedback widgets, UI labels, dates,
// source citations) from converted Markdown and labels the conversation turns.

const BLOCK_START = /^Copied to clipboard/i;
const BLOCK_END = /^Show allShow less\s*$/;
const UI_LINES = new Set(['Copied', 'Copy', 'Edit', '**Searching**']);
const TIME_LINE = /^\d{1,2}:\d{2}(?:\s?[AP]M)?\s*$/i;
const DATE_LINE = /^[A-Z][a-z]+ \d{1,2}, \d{4}\s*$/;
const YOU_SAID = /^#{1,6} You said:.*$/;
const AI_REPLY = /^#{1,6} AI Mode reply for .*$/;
// Blank tracking pixels and favicons only; other images are left to the remove-images option.
const PLACEHOLDER_IMG = /^\s*!\[[^\]]*\]\((?:data:image\/gif[^)]*|https?:\/\/[^)]*(?:gstatic\.com|encrypted-tbn)[^)]*)\)\s*$/;
const SOURCE_CITE = /^[^|#*-].{0,60}\s\+\d+$/;
// Whole-page copies (Ctrl-A): the conversation starts at its title and ends before the footer.
const PAGE_START = /^#{1,6} AI Mode conversation:/;
const PAGE_END = /^#{1,6} Shared\s*$/;
const TURN_BREAK = ['', '---', '', '## User', ''];

export function cleanChatMarkdown(markdown: string): string {
  let lines = markdown.split(/\r?\n/);
  const start = lines.findIndex(l => PAGE_START.test(l));
  if (start >= 0) {
    lines = lines.slice(start);
    // Use the last match: earlier "Shared" headings can occur inside individual turns.
    const end = lines.map(l => PAGE_END.test(l)).lastIndexOf(true);
    if (end >= 0) lines = lines.slice(0, end);
  }
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!.replace(/\u00A0/g, ' ').trimEnd();
    const trimmed = line.trim();

    if (BLOCK_START.test(line)) {
      let j = i;
      while (j < lines.length && !BLOCK_END.test(lines[j]!)) {
        j += 1;
      }
      out.push(...TURN_BREAK);
      i = j + 1;
      continue;
    }

    if (YOU_SAID.test(line)) {
      i += 1;
      continue;
    }
    if (AI_REPLY.test(line)) {
      out.push('', '### Assistant', '');
      i += 1;
      continue;
    }
    if (
      UI_LINES.has(trimmed)
      || DATE_LINE.test(line)
      || TIME_LINE.test(line)
      || PLACEHOLDER_IMG.test(line)
      || SOURCE_CITE.test(trimmed)
    ) {
      i += 1;
      continue;
    }

    out.push(line);
    i += 1;
  }

  return `${out.join('\n')
    .replace(/\n{3,}/g, '\n\n')
    // A turn break with no following content (end of text) is dropped.
    .replace(/\s*---\s*## User\s*$/, '')
    .trim()}\n`;
}
