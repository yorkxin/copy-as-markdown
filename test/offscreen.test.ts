import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard } from '../src/offscreen.js';

describe('copyTextToClipboard', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('writes the text via execCommand and returns ok', () => {
    const textarea = { value: '', select: vi.fn() };
    const execCommand = vi.fn(() => true);
    vi.stubGlobal('document', { getElementById: vi.fn(() => textarea), execCommand });

    const result = copyTextToClipboard('hello');

    expect(result).toEqual({ ok: true });
    expect(textarea.select).toHaveBeenCalledOnce();
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('returns an error when execCommand reports failure', () => {
    const textarea = { value: '', select: vi.fn() };
    vi.stubGlobal('document', { getElementById: () => textarea, execCommand: () => false });

    expect(copyTextToClipboard('x')).toEqual({ ok: false, error: 'execCommand returned false' });
  });

  it('returns an error when the textarea is missing', () => {
    vi.stubGlobal('document', { getElementById: () => null, execCommand: () => true });

    expect(copyTextToClipboard('x').ok).toBe(false);
  });
});
