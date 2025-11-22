import { describe, expect, it } from 'vitest';
import { parseCustomFormatCommand } from '../../src/services/browser-utils.js';

describe('parseCustomFormatCommand', () => {
  it('accepts valid commands for given contexts', () => {
    expect(parseCustomFormatCommand('current-tab-custom-format-1', ['current-tab'] as const))
      .toEqual({ context: 'current-tab', slot: '1' });
    expect(parseCustomFormatCommand('all-tabs-custom-format-3', ['all-tabs', 'highlighted-tabs'] as const))
      .toEqual({ context: 'all-tabs', slot: '3' });
  });

  it('rejects commands outside allowed contexts', () => {
    expect(() => parseCustomFormatCommand('link-custom-format-2', ['current-tab'] as const))
      .toThrow(/unknown custom format command/);
    expect(() => parseCustomFormatCommand('highlighted-tabs-custom-format-x', ['highlighted-tabs'] as const))
      .toThrow(/unknown custom format command/);
    expect(() => parseCustomFormatCommand('nonsense', ['current-tab'] as const))
      .toThrow(/unknown custom format command/);
  });
});
