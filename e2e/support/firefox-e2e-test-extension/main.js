let baseUrl = 'http://localhost:5566';

const URL_PARAMS = new URLSearchParams(window.location.search);

if (URL_PARAMS.has('base_url')) {
  baseUrl = URL_PARAMS.get('base_url');
}

document.querySelector('#open-demo').addEventListener('click', async () => {
  const urls = [0, 1, 2, 3, 4, 5, 6, 7]
    .map((i) => `${baseUrl}/${i}.html`);

  const winDemo = await browser.windows.create({ url: urls });
  document.querySelector('#window-id').value = winDemo.id;
  document.querySelector('#tab-0-id').value = winDemo.tabs[0].id;
});

document.querySelector('#highlight-tabs').addEventListener('click', async () => {
  const windowId = document.querySelector('#window-id').value;
  if (windowId === '') {
    return;
  }

  const winDemo = await browser.windows.get(parseInt(windowId, 10), { populate: true });

  await browser.tabs.update(winDemo.tabs[0].id, { highlighted: true });
  await browser.tabs.update(winDemo.tabs[2].id, { highlighted: true });
  await browser.tabs.update(winDemo.tabs[5].id, { highlighted: true });
});

document.querySelector('#switch-to-demo').addEventListener('click', async () => {
  const windowId = document.querySelector('#window-id').value;
  if (windowId === '') {
    return;
  }

  await browser.windows.update(parseInt(windowId, 10), { focused: true });
});

document.querySelector('#close-demo').addEventListener('click', async () => {
  const windowId = document.querySelector('#window-id').value;
  if (windowId === '') {
    return;
  }

  await browser.windows.remove(parseInt(windowId, 10));
  document.querySelector('#window-id').value = '';
  document.querySelector('#tab-0-id').value = '';
});
