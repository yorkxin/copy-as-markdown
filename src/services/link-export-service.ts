import type { CustomFormatsProvider, MarkdownFormatter } from './shared-types.js';

export interface LinkExportService {
  /**
   * Export a link in the specified format.
   *
   * @param options - Export options
   * @param options.format - Export format: 'link' for markdown link, 'custom-format' for custom template
   * @param options.title - Link title text
   * @param options.url - Link URL
   * @param options.customFormatSlot - Custom format slot (required when format is 'custom-format')
   * @returns Formatted link string
   */
  exportLink: (options: {
    format: 'link' | 'custom-format';
    title: string;
    url: string;
    customFormatSlot?: string | null;
  }) => Promise<string>;
}

export function createLinkExportService(
  markdown: MarkdownFormatter,
  customFormatsProvider: CustomFormatsProvider,
): LinkExportService {
  async function renderCustomFormat(
    slot: string,
    title: string,
    url: string,
  ): Promise<string> {
    const customFormat = await customFormatsProvider.get('single-link', slot);
    const input = { title, url, number: 1 };
    return customFormat.render(input);
  }

  async function exportLink(options: {
    format: 'link' | 'custom-format';
    title: string;
    url: string;
    customFormatSlot?: string | null;
  }): Promise<string> {
    switch (options.format) {
      case 'link':
        return markdown.linkTo(options.title, options.url);

      case 'custom-format':
        if (!options.customFormatSlot) {
          throw new TypeError('customFormatSlot is required for custom-format');
        }
        return renderCustomFormat(
          options.customFormatSlot,
          markdown.escapeLinkText(options.title),
          options.url,
        );

      default:
        throw new TypeError(`invalid format: ${options.format}`);
    }
  }

  return {
    exportLink,
  };
}

export function createBrowserLinkExportService(
  markdown: MarkdownFormatter,
  customFormatsProvider: CustomFormatsProvider,
): LinkExportService {
  return createLinkExportService(markdown, customFormatsProvider);
}
