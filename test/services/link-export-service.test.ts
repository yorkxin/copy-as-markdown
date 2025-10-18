import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createLinkExportService } from '../../src/services/link-export-service.js';
import type {
  CustomFormat,
  CustomFormatsProvider,
  MarkdownFormatter,
} from '../../src/services/link-export-service.js';

describe('LinkExportService', () => {
  describe('exportLink', () => {
    describe('markdown link format', () => {
      it('should export link in markdown format', async () => {
        const linkToMock = mock.fn((title: string, url: string) => `[${title}](${url})`);

        const mockMarkdown: MarkdownFormatter = {
          escapeLinkText: text => text,
          linkTo: linkToMock,
        };

        const mockCustomFormatsProvider: CustomFormatsProvider = {
          get: mock.fn(async () => {
            throw new Error('CustomFormatsProvider.get should not be called in this test');
          }),
        };

        const service = createLinkExportService(mockMarkdown, mockCustomFormatsProvider);

        const result = await service.exportLink({
          format: 'link',
          title: 'Example',
          url: 'https://example.com',
        });

        assert.equal(result, '[Example](https://example.com)');
        assert.equal(linkToMock.mock.calls.length, 1);
        assert.equal(linkToMock.mock.calls[0]!.arguments[0], 'Example');
        assert.equal(linkToMock.mock.calls[0]!.arguments[1], 'https://example.com');
      });

      it('should not call customFormatsProvider when format is link', async () => {
        const getMock = mock.fn(async () => {
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

        assert.equal(getMock.mock.calls.length, 0);
      });
    });

    describe('custom format', () => {
      it('should export link using custom format', async () => {
        const escapeLinkTextMock = mock.fn((text: string) => text.replace('[', '\\['));
        const renderMock = mock.fn((input: { title: string; url: string; number: number }) =>
          `Custom: ${input.title} -> ${input.url}`,
        );

        const mockMarkdown: MarkdownFormatter = {
          escapeLinkText: escapeLinkTextMock,
          linkTo: () => '',
        };

        const mockCustomFormat: CustomFormat = {
          render: renderMock,
        };

        const getMock = mock.fn(async () => mockCustomFormat);

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

        assert.equal(result, 'Custom: Test \\[Link] -> https://example.com');
        assert.equal(getMock.mock.calls.length, 1);
        assert.equal(getMock.mock.calls[0]!.arguments[0], 'single-link');
        assert.equal(getMock.mock.calls[0]!.arguments[1], '1');

        assert.equal(escapeLinkTextMock.mock.calls.length, 1);
        assert.equal(escapeLinkTextMock.mock.calls[0]!.arguments[0], 'Test [Link]');

        assert.equal(renderMock.mock.calls.length, 1);
        const renderCall = renderMock.mock.calls[0]!;
        assert.deepEqual(renderCall.arguments[0], {
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
          get: mock.fn(async () => {
            throw new Error('Should not be called');
          }),
        };

        const service = createLinkExportService(mockMarkdown, mockCustomFormatsProvider);

        await assert.rejects(
          async () =>
            service.exportLink({
              format: 'custom-format',
              title: 'Test',
              url: 'https://example.com',
            }),
          { message: 'customFormatSlot is required for custom-format' },
        );
      });

      it('should throw error when customFormatSlot is null', async () => {
        const mockMarkdown: MarkdownFormatter = {
          escapeLinkText: text => text,
          linkTo: () => '',
        };

        const mockCustomFormatsProvider: CustomFormatsProvider = {
          get: mock.fn(async () => {
            throw new Error('Should not be called');
          }),
        };

        const service = createLinkExportService(mockMarkdown, mockCustomFormatsProvider);

        await assert.rejects(
          async () =>
            service.exportLink({
              format: 'custom-format',
              title: 'Test',
              url: 'https://example.com',
              customFormatSlot: null,
            }),
          { message: 'customFormatSlot is required for custom-format' },
        );
      });
    });

    describe('invalid format', () => {
      it('should throw error for invalid format', async () => {
        const mockMarkdown: MarkdownFormatter = {
          escapeLinkText: text => text,
          linkTo: () => '',
        };

        const mockCustomFormatsProvider: CustomFormatsProvider = {
          get: mock.fn(async () => {
            throw new Error('Should not be called');
          }),
        };

        const service = createLinkExportService(mockMarkdown, mockCustomFormatsProvider);

        await assert.rejects(
          async () =>
            service.exportLink({
              format: 'invalid' as any,
              title: 'Test',
              url: 'https://example.com',
            }),
          { message: 'invalid format: invalid' },
        );
      });
    });
  });
});
