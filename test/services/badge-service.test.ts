/**
 * Unit tests for badge service
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { createBadgeService } from '../../src/services/badge-service.js';
import type { AlarmsAPI, BadgeAPI } from '../../src/services/badge-service.js';

describe('BadgeService', () => {
  describe('showSuccess', () => {
    it('should set success badge with green color and checkmark', async () => {
      // Arrange
      const setBadgeTextMock = mock.fn(async () => { });
      const setBadgeBackgroundColorMock = mock.fn(async () => { });
      const createAlarmMock = mock.fn(() => { });

      const mockBadgeAPI: BadgeAPI = {
        setBadgeText: setBadgeTextMock,
        setBadgeBackgroundColor: setBadgeBackgroundColorMock,
      };

      const mockAlarmsAPI: AlarmsAPI = {
        create: createAlarmMock,
      };

      const badge = createBadgeService(mockBadgeAPI, mockAlarmsAPI);

      // Act
      await badge.showSuccess();

      // Assert
      assert.strictEqual(
        setBadgeTextMock.mock.calls.length,
        1,
        'setBadgeText should be called once',
      );
      assert.deepStrictEqual(
        setBadgeTextMock.mock.calls[0]!.arguments[0],
        { text: '✓' },
        'Badge text should be checkmark',
      );

      assert.strictEqual(
        setBadgeBackgroundColorMock.mock.calls.length,
        1,
        'setBadgeBackgroundColor should be called once',
      );
      assert.deepStrictEqual(
        setBadgeBackgroundColorMock.mock.calls[0]!.arguments[0],
        { color: '#738a05' },
        'Badge color should be green',
      );
    });

    it('should schedule badge clear alarm', async () => {
      // Arrange
      const setBadgeTextMock = mock.fn(async () => { });
      const setBadgeBackgroundColorMock = mock.fn(async () => { });
      const createAlarmMock = mock.fn(() => { });

      const mockBadgeAPI: BadgeAPI = {
        setBadgeText: setBadgeTextMock,
        setBadgeBackgroundColor: setBadgeBackgroundColorMock,
      };

      const mockAlarmsAPI: AlarmsAPI = {
        create: createAlarmMock,
      };

      const badge = createBadgeService(mockBadgeAPI, mockAlarmsAPI);
      const beforeTime = Date.now();

      // Act
      await badge.showSuccess();

      // Assert
      assert.strictEqual(
        createAlarmMock.mock.calls.length,
        1,
        'Alarm should be created',
      );

      const [alarmName, alarmInfo] = createAlarmMock.mock.calls[0]!.arguments;
      assert.strictEqual(alarmName, 'clearBadge', 'Alarm name should be clearBadge');
      assert.ok(
        alarmInfo.when >= beforeTime + 3000,
        'Alarm should be scheduled at least 3 seconds from now',
      );
      assert.ok(
        alarmInfo.when <= Date.now() + 3100,
        'Alarm should be scheduled within 3.1 seconds',
      );
    });
  });

  describe('showError', () => {
    it('should set error badge with red color and X mark', async () => {
      // Arrange
      const setBadgeTextMock = mock.fn(async () => { });
      const setBadgeBackgroundColorMock = mock.fn(async () => { });
      const createAlarmMock = mock.fn(() => { });

      const mockBadgeAPI: BadgeAPI = {
        setBadgeText: setBadgeTextMock,
        setBadgeBackgroundColor: setBadgeBackgroundColorMock,
      };

      const mockAlarmsAPI: AlarmsAPI = {
        create: createAlarmMock,
      };

      const badge = createBadgeService(mockBadgeAPI, mockAlarmsAPI);

      // Act
      await badge.showError();

      // Assert
      assert.strictEqual(
        setBadgeTextMock.mock.calls.length,
        1,
        'setBadgeText should be called once',
      );
      assert.deepStrictEqual(
        setBadgeTextMock.mock.calls[0]!.arguments[0],
        { text: '×' },
        'Badge text should be X mark',
      );

      assert.strictEqual(
        setBadgeBackgroundColorMock.mock.calls.length,
        1,
        'setBadgeBackgroundColor should be called once',
      );
      assert.deepStrictEqual(
        setBadgeBackgroundColorMock.mock.calls[0]!.arguments[0],
        { color: '#d11b24' },
        'Badge color should be red',
      );
    });

    it('should schedule badge clear alarm', async () => {
      // Arrange
      const setBadgeTextMock = mock.fn(async () => { });
      const setBadgeBackgroundColorMock = mock.fn(async () => { });
      const createAlarmMock = mock.fn(() => { });

      const mockBadgeAPI: BadgeAPI = {
        setBadgeText: setBadgeTextMock,
        setBadgeBackgroundColor: setBadgeBackgroundColorMock,
      };

      const mockAlarmsAPI: AlarmsAPI = {
        create: createAlarmMock,
      };

      const badge = createBadgeService(mockBadgeAPI, mockAlarmsAPI);

      // Act
      await badge.showError();

      // Assert
      assert.strictEqual(
        createAlarmMock.mock.calls.length,
        1,
        'Alarm should be created',
      );

      const [alarmName] = createAlarmMock.mock.calls[0]!.arguments;
      assert.strictEqual(alarmName, 'clearBadge', 'Alarm name should be clearBadge');
    });
  });

  describe('clear', () => {
    it('should clear badge text and set transparent background', async () => {
      // Arrange
      const setBadgeTextMock = mock.fn(async () => { });
      const setBadgeBackgroundColorMock = mock.fn(async () => { });
      const createAlarmMock = mock.fn(() => { });

      const mockBadgeAPI: BadgeAPI = {
        setBadgeText: setBadgeTextMock,
        setBadgeBackgroundColor: setBadgeBackgroundColorMock,
      };

      const mockAlarmsAPI: AlarmsAPI = {
        create: createAlarmMock,
      };

      const badge = createBadgeService(mockBadgeAPI, mockAlarmsAPI);

      // Act
      await badge.clear();

      // Assert
      assert.strictEqual(
        setBadgeTextMock.mock.calls.length,
        1,
        'setBadgeText should be called once',
      );
      assert.deepStrictEqual(
        setBadgeTextMock.mock.calls[0]!.arguments[0],
        { text: '' },
        'Badge text should be empty',
      );

      assert.strictEqual(
        setBadgeBackgroundColorMock.mock.calls.length,
        1,
        'setBadgeBackgroundColor should be called once',
      );
      assert.deepStrictEqual(
        setBadgeBackgroundColorMock.mock.calls[0]!.arguments[0],
        { color: [0, 0, 0, 0] },
        'Badge color should be transparent',
      );
    });

    it('should not create any alarm', async () => {
      // Arrange
      const setBadgeTextMock = mock.fn(async () => { });
      const setBadgeBackgroundColorMock = mock.fn(async () => { });
      const createAlarmMock = mock.fn(() => { });

      const mockBadgeAPI: BadgeAPI = {
        setBadgeText: setBadgeTextMock,
        setBadgeBackgroundColor: setBadgeBackgroundColorMock,
      };

      const mockAlarmsAPI: AlarmsAPI = {
        create: createAlarmMock,
      };

      const badge = createBadgeService(mockBadgeAPI, mockAlarmsAPI);

      // Act
      await badge.clear();

      // Assert
      assert.strictEqual(
        createAlarmMock.mock.calls.length,
        0,
        'No alarm should be created',
      );
    });
  });

  describe('getClearAlarmName', () => {
    it('should return the correct alarm name', () => {
      // Arrange
      const setBadgeTextMock = mock.fn(async () => { });
      const setBadgeBackgroundColorMock = mock.fn(async () => { });
      const createAlarmMock = mock.fn(() => { });

      const mockBadgeAPI: BadgeAPI = {
        setBadgeText: setBadgeTextMock,
        setBadgeBackgroundColor: setBadgeBackgroundColorMock,
      };

      const mockAlarmsAPI: AlarmsAPI = {
        create: createAlarmMock,
      };

      const badge = createBadgeService(mockBadgeAPI, mockAlarmsAPI);

      // Act
      const alarmName = badge.getClearAlarmName();

      // Assert
      assert.strictEqual(alarmName, 'clearBadge', 'Alarm name should be clearBadge');
    });
  });

  describe('Integration: success then clear', () => {
    it('should show success badge and then clear it', async () => {
      // Arrange
      const setBadgeTextMock = mock.fn(async () => { });
      const setBadgeBackgroundColorMock = mock.fn(async () => { });
      const createAlarmMock = mock.fn(() => { });

      const mockBadgeAPI: BadgeAPI = {
        setBadgeText: setBadgeTextMock,
        setBadgeBackgroundColor: setBadgeBackgroundColorMock,
      };

      const mockAlarmsAPI: AlarmsAPI = {
        create: createAlarmMock,
      };

      const badge = createBadgeService(mockBadgeAPI, mockAlarmsAPI);

      // Act
      await badge.showSuccess();
      await badge.clear();

      // Assert - success was shown
      assert.deepStrictEqual(
        setBadgeTextMock.mock.calls[0]!.arguments[0],
        { text: '✓' },
      );

      // Assert - then cleared
      assert.deepStrictEqual(
        setBadgeTextMock.mock.calls[1]!.arguments[0],
        { text: '' },
      );
    });
  });
});
