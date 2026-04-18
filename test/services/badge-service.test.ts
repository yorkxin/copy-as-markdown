import { describe, expect, it, vi } from 'vitest';
import { createBadgeService } from '../../src/services/badge-service.js';

describe('badgeService', () => {
  it('shows a success badge and schedules auto-clear', async () => {
    const setBadgeText = vi.fn(async () => undefined);
    const setBadgeBackgroundColor = vi.fn(async () => undefined);
    const createAlarm = vi.fn();

    const service = createBadgeService(
      { setBadgeText, setBadgeBackgroundColor },
      { create: createAlarm },
    );

    await service.showSuccess();

    expect(setBadgeText).toHaveBeenCalledWith({ text: '✓' });
    expect(setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#738a05' });
    expect(createAlarm).toHaveBeenCalledExactlyOnceWith(
      service.getClearAlarmName(),
      expect.objectContaining({ when: expect.any(Number) }),
    );
  });

  it('shows an error badge and schedules auto-clear', async () => {
    const setBadgeText = vi.fn(async () => undefined);
    const setBadgeBackgroundColor = vi.fn(async () => undefined);
    const createAlarm = vi.fn();

    const service = createBadgeService(
      { setBadgeText, setBadgeBackgroundColor },
      { create: createAlarm },
    );

    await service.showError();

    expect(setBadgeText).toHaveBeenCalledWith({ text: '×' });
    expect(setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#d11b24' });
    expect(createAlarm).toHaveBeenCalledExactlyOnceWith(
      service.getClearAlarmName(),
      expect.objectContaining({ when: expect.any(Number) }),
    );
  });

  it('shows a persistent warning badge without scheduling auto-clear', async () => {
    const setBadgeText = vi.fn(async () => undefined);
    const setBadgeBackgroundColor = vi.fn(async () => undefined);
    const createAlarm = vi.fn();

    const service = createBadgeService(
      { setBadgeText, setBadgeBackgroundColor },
      { create: createAlarm },
    );

    await service.showWarning();

    expect(setBadgeText).toHaveBeenCalledWith({ text: '!' });
    expect(setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#b7791f' });
    expect(createAlarm).not.toHaveBeenCalled();
  });
});
