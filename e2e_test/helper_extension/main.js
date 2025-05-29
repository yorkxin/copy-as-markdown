let baseUrl = 'http://localhost:5566';

const URL_PARAMS = new URLSearchParams(window.location.search);

if (URL_PARAMS.has('base_url')) {
  baseUrl = URL_PARAMS.get('base_url');
}

document.querySelector('#open-demo').addEventListener('click', async () => {
  const urls = [0, 1, 2, 3, 4, 5, 6, 7]
    .map((i) => `${baseUrl}/${i}.html`);

  const winDemo = await chrome.windows.create({ url: urls });
  document.querySelector('#window-id').value = winDemo.id;
  document.querySelector('#tab-0-id').value = winDemo.tabs[0].id;
});

document.querySelector('#group-tabs').addEventListener('click', async () => {
  const windowId = document.querySelector('#window-id').value;
  if (windowId === '') {
    return;
  }

  const winDemo = await chrome.windows.get(parseInt(windowId, 10), { populate: true });
  const group1 = await chrome.tabs.group({
    tabIds: [winDemo.tabs[1].id, winDemo.tabs[2].id],
    createProperties: { windowId: winDemo.id },
  });

  await chrome.tabGroups.update(group1, { title: 'Group 1' });

  const group2 = await chrome.tabs.group({
    tabIds: [winDemo.tabs[5].id, winDemo.tabs[6].id],
    createProperties: { windowId: winDemo.id },
  });

  await chrome.tabGroups.update(group2, { color: 'green' });
});

document.querySelector('#highlight-tabs').addEventListener('click', async () => {
  const windowId = document.querySelector('#window-id').value;
  if (windowId === '') {
    return;
  }

  const winDemo = await chrome.windows.get(parseInt(windowId, 10), { populate: true });

  await chrome.tabs.update(winDemo.tabs[0].id, { highlighted: true });
  await chrome.tabs.update(winDemo.tabs[1].id, { highlighted: false });
  await chrome.tabs.update(winDemo.tabs[2].id, { highlighted: true });
  await chrome.tabs.update(winDemo.tabs[3].id, { highlighted: false });
  await chrome.tabs.update(winDemo.tabs[4].id, { highlighted: false });
  await chrome.tabs.update(winDemo.tabs[5].id, { highlighted: true });
  await chrome.tabs.update(winDemo.tabs[6].id, { highlighted: false });
  await chrome.tabs.update(winDemo.tabs[7].id, { highlighted: false });
});

document.querySelector('#ungroup-tabs').addEventListener('click', async () => {
  const windowId = document.querySelector('#window-id').value;
  if (windowId === '') {
    return;
  }

  const winDemo = await chrome.windows.get(parseInt(windowId, 10), { populate: true });

  const tabIds = winDemo.tabs.map((tab) => tab.id);
  await Promise.all(tabIds.map((tabId) => chrome.tabs.ungroup(tabId)));
});

document.querySelector('#switch-to-demo').addEventListener('click', async () => {
  const windowId = document.querySelector('#window-id').value;
  if (windowId === '') {
    return;
  }

  await chrome.windows.update(parseInt(windowId, 10), { focused: true });
});

document.querySelector('#close-demo').addEventListener('click', async () => {
  const windowId = document.querySelector('#window-id').value;
  if (windowId === '') {
    return;
  }

  await chrome.windows.remove(parseInt(windowId, 10));
  document.querySelector('#window-id').value = '';
  document.querySelector('#tab-0-id').value = '';
});
