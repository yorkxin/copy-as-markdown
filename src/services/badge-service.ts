/**
 * Badge Service
 *
 * Handles browser extension badge (icon badge text and color) for visual feedback.
 * Shows success/error states that auto-clear after a timeout.
 */

// Type Definitions
type ColorArray = [number, number, number, number];
type BadgeColor = string | ColorArray;

// Constants
const COLOR_GREEN = '#738a05';
const COLOR_RED = '#d11b24';
const COLOR_TRANSPARENT: ColorArray = [0, 0, 0, 0];

const TEXT_OK = '✓';
const TEXT_ERROR = '×';
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

/**
 * Creates a badge service instance.
 *
 * @param badgeAPI - The browser badge API (browser.browserAction or chrome.action)
 * @param alarmsAPI - The browser alarms API for scheduling badge clear
 * @returns Badge service with methods to show success/error and clear badge
 *
 * @example
 * ```typescript
 * const badge = createBadgeService(
 *   browser.browserAction || chrome.action,
 *   browser.alarms
 * );
 *
 * await badge.showSuccess();
 * // Badge shows ✓ with green background, auto-clears after 3s
 * ```
 */
export function createBadgeService(
  badgeAPI: BadgeAPI,
  alarmsAPI: AlarmsAPI,
) {
  return {
    /**
     * Shows success badge (✓ with green background).
     * Badge will auto-clear after 3 seconds.
     *
     * Note: Calling this multiple times will reset the 3-second timer.
     */
    async showSuccess(): Promise<void> {
      await Promise.all([
        badgeAPI.setBadgeText({ text: TEXT_OK }),
        badgeAPI.setBadgeBackgroundColor({ color: COLOR_GREEN }),
      ]);
      // Creating an alarm with the same name replaces any existing alarm
      alarmsAPI.create(ALARM_NAME_CLEAR_BADGE, { when: Date.now() + FLASH_DURATION_MS });
    },

    /**
     * Shows error badge (× with red background).
     * Badge will auto-clear after 3 seconds.
     *
     * Note: Calling this multiple times will reset the 3-second timer.
     */
    async showError(): Promise<void> {
      await Promise.all([
        badgeAPI.setBadgeText({ text: TEXT_ERROR }),
        badgeAPI.setBadgeBackgroundColor({ color: COLOR_RED }),
      ]);
      // Creating an alarm with the same name replaces any existing alarm
      alarmsAPI.create(ALARM_NAME_CLEAR_BADGE, { when: Date.now() + FLASH_DURATION_MS });
    },

    /**
     * Clears the badge (removes text and resets to transparent).
     * This is automatically called after the flash duration expires.
     */
    async clear(): Promise<void> {
      await Promise.all([
        badgeAPI.setBadgeText({ text: TEXT_EMPTY }),
        badgeAPI.setBadgeBackgroundColor({ color: COLOR_TRANSPARENT }),
      ]);
    },

    /**
     * Returns the alarm name used for clearing the badge.
     * Use this to handle the alarm event in your alarm listener.
     *
     * @example
     * ```typescript
     * browser.alarms.onAlarm.addListener(async (alarm) => {
     *   if (alarm.name === badge.getClearAlarmName()) {
     *     await badge.clear();
     *   }
     * });
     * ```
     */
    getClearAlarmName(): string {
      return ALARM_NAME_CLEAR_BADGE;
    },
  };
}

export type BadgeService = ReturnType<typeof createBadgeService>;

/**
 * Creates a badge service using the browser's native APIs.
 * Automatically detects whether to use browser.browserAction (Firefox MV2)
 * or chrome.action (Chrome MV3).
 *
 * @example
 * ```typescript
 * const badge = createBrowserBadgeService();
 * await badge.showSuccess();
 * ```
 */
export function createBrowserBadgeService(): BadgeService {
  const badgeAPI = (typeof browser !== 'undefined' && typeof browser.browserAction !== 'undefined')
    ? browser.browserAction
    : chrome.action;

  return createBadgeService(badgeAPI, browser.alarms);
}
