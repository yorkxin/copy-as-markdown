const COLOR_GREEN = '#738a05';
const COLOR_RED = '#d11b24';
const COLOR_OPAQUE = [0, 0, 0, 255];

const TEXT_OK = '✓';
const TEXT_ERROR = '!';
const TEXT_EMPTY = '';

const FLASH_BADGE_TIMEOUT = 3000; // ms

function setBadgeText(text) {
  const string = String(text);
  return new Promise((resolve) => chrome.browserAction.setBadgeText({ text: string }, resolve));
}

function setBadgeBackgroundColor(color) {
  return new Promise((resolve) => chrome.browserAction.setBadgeBackgroundColor({ color }, resolve));
}

async function setBadge(text, color) {
  await setBadgeText(text);
  await setBadgeBackgroundColor(color);
}

async function clearBadge() {
  return setBadge(TEXT_EMPTY, COLOR_OPAQUE);
}

export async function flashBadge(type) {
  switch (type) {
    case 'success':
      await setBadge(TEXT_OK, COLOR_GREEN);
      break;
    case 'fail':
      await setBadge(TEXT_ERROR, COLOR_RED);
      break;
    default:
      return; // don't know what it is. quit.
  }

  setTimeout(clearBadge, FLASH_BADGE_TIMEOUT);
}

export function flashSuccessBadge() {
  return flashBadge('success');
}
