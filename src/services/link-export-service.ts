import type { CustomFormatsProvider, MarkdownFormatter } from './shared-types.js';
import { selectivelyDecodeUrl } from '../lib/url-utils.js';

// Type Definitions
export type LinkExportFormat = 'link' | 'link-without-encoding' | 'custom-format';

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

/**
 * Renders a link using a custom format template.
 */
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
   * Export a link in the specified format.
   *
   * @param options - Export options
   * @param options.format - Export format: 'link' for markdown link, 'custom-format' for custom template
   * @param options.title - Link title text
   * @param options.url - Link URL
   * @param options.customFormatSlot - Custom format slot (required when format is 'custom-format')
   * @returns Formatted link string
   * @throws {TypeError} If format is invalid or customFormatSlot is missing for custom-format
   */
  async exportLink(options: LinkExportOptions): Promise<string> {
    // Validate options
    validateLinkExportOptions(options);

    // Route to appropriate formatter
    switch (options.format) {
      case 'link':
        return this.markdown.linkTo(options.title, options.url);

      case 'link-without-encoding': {
        const decodedUrl = selectivelyDecodeUrl(options.url);
        return this.markdown.linkTo(options.title, decodedUrl);
      }

      case 'custom-format':
        // We already validated that customFormatSlot exists
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
