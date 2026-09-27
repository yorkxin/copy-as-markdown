import type { CustomFormatsProvider, MarkdownFormatter } from './shared-types.js';

export type LinkExportFormat = 'link' | 'custom-format';

export interface LinkExportOptions {
  format: LinkExportFormat;
  title: string;
  url: string;
  customFormatSlot?: string | null;
}

export function validateLinkExportOptions(options: LinkExportOptions): void {
  if (options.format === 'custom-format' && !options.customFormatSlot) {
    throw new TypeError('customFormatSlot is required for custom-format');
  }
}

export async function renderCustomFormatLink(
  title: string,
  url: string,
  slot: string,
  formatTitle: (text: string) => string,
  customFormatsProvider: CustomFormatsProvider,
): Promise<string> {
  const customFormat = await customFormatsProvider.get('single-link', slot);
  const input = {
    title: formatTitle(title),
    url,
    number: 1,
  };
  return customFormat.render(input);
}

export class LinkExportService {
  constructor(
    private markdown: MarkdownFormatter,
    private customFormatsProvider: CustomFormatsProvider,
  ) { }

  /**
   * Exports a Markdown link or renders the selected custom format.
   *
   * @throws {TypeError} When custom-format has no slot or format is invalid.
   */
  async exportLink(options: LinkExportOptions): Promise<string> {
    validateLinkExportOptions(options);

    switch (options.format) {
      case 'link':
        return this.markdown.linkTo(options.title, options.url);

      case 'custom-format':
        return renderCustomFormatLink(
          options.title,
          options.url,
          options.customFormatSlot!,
          // TODO: implement flexible title formatter.
          // See https://github.com/yorkxin/copy-as-markdown/issues/133
          text => this.markdown.escapeLinkText(text),
          this.customFormatsProvider,
        );

      default:
        throw new TypeError(`invalid format: ${options.format}`);
    }
  }
}
