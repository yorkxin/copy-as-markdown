import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLinkExportService } from '../../src/services/link-export-service.js';
import type {
  CustomFormat,
  CustomFormatsProvider,
  MarkdownFormatter,
} from '../../src/services/shared-types.js';

describe('linkExportService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exportLink', () => {
    describe('markdown link format', () => {
      it('should export link in markdown format', async () => {
        const linkToMock = vi.fn((title: string, url: string) => `[${title}](${url})`);

        const mockMarkdown: MarkdownFormatter = {
          escapeLinkText: text => text,
          linkTo: linkToMock,
        };

        const mockCustomFormatsProvider: CustomFormatsProvider = {
          get: vi.fn(async () => {
            throw new Error('CustomFormatsProvider.get should not be called in this test');
          }),
        };

        const service = createLinkExportService(mockMarkdown, mockCustomFormatsProvider);

        const result = await service.exportLink({
          format: 'link',
          title: 'Example',
          url: 'https://example.com',
        });

        expect(result, '[Example](https://example.com)');
        expect(linkToMock).toHaveBeenCalledTimes(1);
        expect(linkToMock).toHaveBeenCalledWith('Example', 'https://example.com');
      });

      it('should not call customFormatsProvider when format is link', async () => {
        const getMock = vi.fn(async () => {
          throw new Error('CustomFormatsProvider.get should not be called');
        });

        const mockMarkdown: MarkdownFormatter = {
          escapeLinkText: text => text,
          linkTo: (title, url) => `[${title}](${url})`,
        };

        const mockCustomFormatsProvider: CustomFormatsProvider = {
          get: getMock,
        };

        const service = createLinkExportService(mockMarkdown, mockCustomFormatsProvider);

        await service.exportLink({
          format: 'link',
          title: 'Test',
          url: 'https://test.com',
        });

        expect(getMock).toHaveBeenCalledTimes(0);
      });
    });

    describe('custom format', () => {
      it('should export link using custom format', async () => {
        const escapeLinkTextMock = vi.fn((text: string) => text.replace('[', '\\['));
        const renderMock = vi.fn((input: { title: string; url: string; number: number }) =>
          `Custom: ${input.title} -> ${input.url}`,
        );

        const mockMarkdown: MarkdownFormatter = {
          escapeLinkText: escapeLinkTextMock,
          linkTo: () => '',
        };

        const mockCustomFormat: CustomFormat = {
          render: renderMock,
        };

        const getMock = vi.fn(async () => mockCustomFormat);

        const mockCustomFormatsProvider: CustomFormatsProvider = {
          get: getMock,
        };

        const service = createLinkExportService(mockMarkdown, mockCustomFormatsProvider);

        const result = await service.exportLink({
          format: 'custom-format',
          title: 'Test [Link]',
          url: 'https://example.com',
          customFormatSlot: '1',
        });

        expect(result).toBe('Custom: Test \\[Link] -> https://example.com');
        expect(getMock).toHaveBeenCalledTimes(1);
        expect(getMock).toHaveBeenCalledWith('single-link', '1');

        expect(escapeLinkTextMock).toHaveBeenCalledTimes(1);
        expect(escapeLinkTextMock).toHaveBeenCalledWith('Test [Link]');

        expect(renderMock).toHaveBeenCalledTimes(1);
        expect(renderMock).toHaveBeenCalledWith({
          title: 'Test \\[Link]',
          url: 'https://example.com',
          number: 1,
        });
      });

      it('should throw error when customFormatSlot is not provided', async () => {
        const mockMarkdown: MarkdownFormatter = {
          escapeLinkText: text => text,
          linkTo: () => '',
        };

        const mockCustomFormatsProvider: CustomFormatsProvider = {
          get: vi.fn(async () => {
            throw new Error('Should not be called');
          }),
        };

        const service = createLinkExportService(mockMarkdown, mockCustomFormatsProvider);

        await expect(
          service.exportLink({
            format: 'custom-format',
            title: 'Test',
            url: 'https://example.com',
          }),
        ).rejects.toThrow('customFormatSlot is required for custom-format');
      });

      it('should throw error when customFormatSlot is null', async () => {
        const mockMarkdown: MarkdownFormatter = {
          escapeLinkText: text => text,
          linkTo: () => '',
        };

        const mockCustomFormatsProvider: CustomFormatsProvider = {
          get: vi.fn(async () => {
            throw new Error('Should not be called');
          }),
        };

        const service = createLinkExportService(mockMarkdown, mockCustomFormatsProvider);

        await expect(
          service.exportLink({
            format: 'custom-format',
            title: 'Test',
            url: 'https://example.com',
            customFormatSlot: null,
          }),
        ).rejects.toThrow('customFormatSlot is required for custom-format');
      });
    });

    describe('invalid format', () => {
      it('should throw error for invalid format', async () => {
        const mockMarkdown: MarkdownFormatter = {
          escapeLinkText: text => text,
          linkTo: () => '',
        };

        const mockCustomFormatsProvider: CustomFormatsProvider = {
          get: vi.fn(async () => {
            throw new Error('Should not be called');
          }),
        };

        const service = createLinkExportService(mockMarkdown, mockCustomFormatsProvider);

        await expect(
          service.exportLink({
            format: 'invalid' as any,
            title: 'Test',
            url: 'https://example.com',
          }),
        ).rejects.toThrow('invalid format: invalid');
      });
    });
  });
});
