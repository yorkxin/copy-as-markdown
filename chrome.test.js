const clipboard = require('clipboardy');

describe('Chrome', () => {
  // let page;
  // beforeAll(async () => {
  //   page = await globalThis.__BROWSER_GLOBAL__.newPage();
  //   await page.goto('https://google.com');
  // });
  //
  it('test', async () => {
    const testPage = await globalThis.__BROWSER_GLOBAL__.newPage();
    await testPage.goto('http://exmaple.com');

    const popup = await globalThis.__BROWSER_GLOBAL__.newPage();
    await popup.goto(`chrome-extension://${globalThis.extensionId}/ui/popup.html`);
    await popup.click('[data-action="all-tabs-link-as-list"]');

    expect(await clipboard.read()).toEqual('[Example Domain](http://example.com)');

    // const { extensionId } = globalThis;
    //
    // expect(extensionId).toEqual('abc');
  });
  //
  // it('should load without error', async () => {
  //   const text = await page.evaluate(() => document.body.textContent);
  //   expect(text).toContain('google');
  // });
});
