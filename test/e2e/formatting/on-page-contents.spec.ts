import { expect, test } from '../fixtures';
import {
  resetMockClipboard,
  triggerContextMenu,
  waitForMockClipboard,
} from '../helpers';

const QA_PAGE_URL = 'http://localhost:5566/qa.html';

test.describe('On-Page contents', () => {
  test.beforeEach(async ({ page, serviceWorker }) => {
    await resetMockClipboard(serviceWorker);
    await page.goto(QA_PAGE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('copies link as markdown', async ({ page, serviceWorker }) => {
    const linkData = await page.locator('#link-1').evaluate((node) => {
      if (!(node instanceof HTMLAnchorElement)) {
        throw new TypeError('Node is not an anchor element');
      }
      return {
        href: node.href,
        text: node.textContent ?? '',
      };
    });

    await triggerContextMenu(serviceWorker, 'link', {
      linkUrl: linkData.href,
      selectionText: linkData.text,
    });

    const clipboardText = (await waitForMockClipboard(serviceWorker)).text;
    expect(clipboardText).toBe('[[APOLLO-13] Build A Rocket Engine](about:blank)');
  });

  test('copies page link as markdown', async ({ page, serviceWorker }) => {
    await triggerContextMenu(serviceWorker, 'current-tab');

    const clipboardText = (await waitForMockClipboard(serviceWorker)).text;
    const expected = `[[QA] \\*\\*Hello\\*\\* \\_World\\_](${page.url()})`;
    expect(clipboardText).toBe(expected);
  });

  test('copies image as markdown', async ({ page, serviceWorker }) => {
    const srcUrl = await page.locator('#img-1').evaluate((node) => {
      if (!(node instanceof HTMLImageElement)) {
        throw new TypeError('Node is not an image element');
      }
      return node.src;
    });

    await triggerContextMenu(serviceWorker, 'image', {
      mediaType: 'image',
      srcUrl,
    });

    const clipboardText = (await waitForMockClipboard(serviceWorker)).text;
    expect(clipboardText).toBe(`![](${srcUrl})`);
  });

  test('copies linked image as markdown', async ({ page, serviceWorker }) => {
    const linkedImage = await page.locator('#link-9').evaluate((node) => {
      if (!(node instanceof HTMLAnchorElement)) {
        throw new TypeError('Node is not an anchor element');
      }
      const image = node.querySelector('img');
      if (!(image instanceof HTMLImageElement)) {
        throw new TypeError('Linked image not found');
      }
      return {
        href: node.href,
        src: image.src,
      };
    });

    await triggerContextMenu(serviceWorker, 'link', {
      mediaType: 'image',
      linkUrl: linkedImage.href,
      srcUrl: linkedImage.src,
    });

    const clipboardText = (await waitForMockClipboard(serviceWorker)).text;
    expect(clipboardText).toBe(`[![](${linkedImage.src})](${linkedImage.href})`);
  });
});
