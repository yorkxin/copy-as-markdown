/**
 * Unit tests for badge service
 */

import { describe, expect, it, vi } from 'vitest';
import { createBadgeService } from '../../src/services/badge-service.js';
import type { AlarmsAPI, BadgeAPI } from '../../src/services/badge-service.js';

describe('badgeService', () => {
  describe('showSuccess', () => {
    it('should set success badge with green color and checkmark', async () => {
      // Arrange
      const setBadgeTextMock = vi.fn(async () => { });
      const setBadgeBackgroundColorMock = vi.fn(async () => { });
      const createAlarmMock = vi.fn(() => { });

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
      expect(setBadgeTextMock).toHaveBeenCalledTimes(1);
      expect(setBadgeTextMock).toHaveBeenCalledWith({ text: '✓' });

      expect(setBadgeBackgroundColorMock).toHaveBeenCalledTimes(1);
      expect(setBadgeBackgroundColorMock).toHaveBeenCalledWith({ color: '#738a05' });
    });

    it('should schedule badge clear alarm', async () => {
      // Arrange
      const setBadgeTextMock = vi.fn(async () => { });
      const setBadgeBackgroundColorMock = vi.fn(async () => { });
      const createAlarmMock = vi.fn(() => { });

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
      expect(createAlarmMock).toHaveBeenCalledWith(
        'clearBadge',
        expect.objectContaining({
          when: expect.any(Number),
        }),
      );
    });
  });

  describe('showError', () => {
    it('should set error badge with red color and X mark', async () => {
      // Arrange
      const setBadgeTextMock = vi.fn(async () => { });
      const setBadgeBackgroundColorMock = vi.fn(async () => { });
      const createAlarmMock = vi.fn(() => { });

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
      expect(setBadgeTextMock).toHaveBeenCalledTimes(1);
      expect(setBadgeTextMock).toHaveBeenCalledWith({ text: '×' });

      expect(setBadgeBackgroundColorMock).toHaveBeenCalledTimes(1);
      expect(setBadgeBackgroundColorMock).toHaveBeenCalledWith({ color: '#d11b24' });
    });

    it('should schedule badge clear alarm', async () => {
      // Arrange
      const setBadgeTextMock = vi.fn(async () => { });
      const setBadgeBackgroundColorMock = vi.fn(async () => { });
      const createAlarmMock = vi.fn(() => { });

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
      expect(createAlarmMock).toHaveBeenCalledWith(
        'clearBadge',
        expect.any(Object),
      );
    });
  });

  describe('clear', () => {
    it('should clear badge text and set transparent background', async () => {
      // Arrange
      const setBadgeTextMock = vi.fn(async () => { });
      const setBadgeBackgroundColorMock = vi.fn(async () => { });
      const createAlarmMock = vi.fn(() => { });

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
      expect(setBadgeTextMock).toHaveBeenCalledTimes(1);
      expect(setBadgeTextMock).toHaveBeenCalledWith({ text: '' });

      expect(setBadgeBackgroundColorMock).toHaveBeenCalledTimes(1);
      expect(setBadgeBackgroundColorMock).toHaveBeenCalledWith({ color: [0, 0, 0, 0] });
    });

    it('should not create any alarm', async () => {
      // Arrange
      const setBadgeTextMock = vi.fn(async () => { });
      const setBadgeBackgroundColorMock = vi.fn(async () => { });
      const createAlarmMock = vi.fn(() => { });

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
      expect(createAlarmMock).toHaveBeenCalledTimes(0);
    });
  });

  describe('getClearAlarmName', () => {
    it('should return the correct alarm name', () => {
      // Arrange
      const setBadgeTextMock = vi.fn(async () => { });
      const setBadgeBackgroundColorMock = vi.fn(async () => { });
      const createAlarmMock = vi.fn(() => { });

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
      expect(alarmName).toBe('clearBadge');
    });
  });

  describe('integration: success then clear', () => {
    it('should show success badge and then clear it', async () => {
      // Arrange
      const setBadgeTextMock = vi.fn(async () => { });
      const setBadgeBackgroundColorMock = vi.fn(async () => { });
      const createAlarmMock = vi.fn(() => { });

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
      expect(setBadgeTextMock).toHaveBeenNthCalledWith(1, { text: '✓' });

      // Assert - then cleared
      expect(setBadgeTextMock).toHaveBeenNthCalledWith(2, { text: '' });
    });
  });
});
