const COLOR_GREEN = '#738a05';
const COLOR_RED = '#d11b24';
const COLOR_OPAQUE = [0, 0, 0, 255];

const TEXT_OK = '✓';
const TEXT_ERROR = '×';
const TEXT_EMPTY = '';

const FLASH_BADGE_TIMEOUT = 3000; // ms

export default async function flashBadge(type) {
  switch (type) {
    case 'success':
      await chrome.action.setBadgeText({ text: TEXT_OK });
      await chrome.action.setBadgeBackgroundColor({ color: COLOR_GREEN });
      break;
    case 'fail':
      await chrome.action.setBadgeText({ text: TEXT_ERROR });
      await chrome.action.setBadgeBackgroundColor({ color: COLOR_RED });
      break;
    default:
      return; // don't know what it is. quit.
  }

  setTimeout(async () => {
    await chrome.action.setBadgeText({ text: TEXT_EMPTY });
    await chrome.action.setBadgeBackgroundColor({ color: COLOR_OPAQUE });
  }, FLASH_BADGE_TIMEOUT);
}
