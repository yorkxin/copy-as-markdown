type ColorArray = [number, number, number, number];
type BadgeColor = string | ColorArray;

const COLOR_GREEN = '#738a05';
const COLOR_RED = '#d11b24';
const COLOR_YELLOW = '#b7791f';
const COLOR_TRANSPARENT: ColorArray = [0, 0, 0, 0];

const TEXT_OK = '✓';
const TEXT_ERROR = '×';
const TEXT_WARNING = '!';
const TEXT_EMPTY = '';

const FLASH_DURATION_MS = 3000;

const ALARM_NAME_CLEAR_BADGE = 'clearBadge';

export interface BadgeAPI {
  setBadgeText: (details: { text: string }) => Promise<void>;
  setBadgeBackgroundColor: (details: { color: BadgeColor }) => Promise<void>;
}

export interface AlarmsAPI {
  create: (name: string, alarmInfo: { when: number }) => void;
}

export function createBadgeService(
  badgeAPI: BadgeAPI,
  alarmsAPI: AlarmsAPI,
) {
  // Reusing the alarm name replaces the alarm, so repeated flashes reset the timeout.
  return {
    /**
     * Shows a green `✓` and schedules its clear alarm for three seconds later;
     * repeated calls restart the timer.
     */
    async showSuccess(): Promise<void> {
      await Promise.all([
        badgeAPI.setBadgeText({ text: TEXT_OK }),
        badgeAPI.setBadgeBackgroundColor({ color: COLOR_GREEN }),
      ]);
      alarmsAPI.create(ALARM_NAME_CLEAR_BADGE, { when: Date.now() + FLASH_DURATION_MS });
    },

    /**
     * Shows a red `×` and schedules its clear alarm for three seconds later;
     * repeated calls restart the timer.
     */
    async showError(): Promise<void> {
      await Promise.all([
        badgeAPI.setBadgeText({ text: TEXT_ERROR }),
        badgeAPI.setBadgeBackgroundColor({ color: COLOR_RED }),
      ]);
      alarmsAPI.create(ALARM_NAME_CLEAR_BADGE, { when: Date.now() + FLASH_DURATION_MS });
    },

    /** Warning state persists until clear() is called. */
    async showWarning(): Promise<void> {
      await Promise.all([
        badgeAPI.setBadgeText({ text: TEXT_WARNING }),
        badgeAPI.setBadgeBackgroundColor({ color: COLOR_YELLOW }),
      ]);
    },

    async clear(): Promise<void> {
      await Promise.all([
        badgeAPI.setBadgeText({ text: TEXT_EMPTY }),
        badgeAPI.setBadgeBackgroundColor({ color: COLOR_TRANSPARENT }),
      ]);
    },

    /**
     * Identifies the alarm that clears transient badges.
     *
     * @example
     * browser.alarms.onAlarm.addListener(async (alarm) => {
     *   if (alarm.name === badge.getClearAlarmName()) {
     *     await badge.clear();
     *   }
     * });
     */
    getClearAlarmName(): string {
      return ALARM_NAME_CLEAR_BADGE;
    },
  };
}

export type BadgeService = ReturnType<typeof createBadgeService>;

export function createBrowserBadgeService(): BadgeService {
  return createBadgeService(browser.action, browser.alarms);
}
