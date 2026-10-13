import type { Options as TurndownOptions } from 'turndown';
import type { CleanupSettings } from '../lib/cleanup-settings.js';

export type MarkdownConversionOptions = TurndownOptions & Partial<CleanupSettings>;

export const OFFSCREEN_CLIPBOARD_TARGET = 'offscreen-clipboard';
export const OFFSCREEN_MARKDOWN_TARGET = 'offscreen-markdown';

export interface OffscreenClipboardMessage {
  target: typeof OFFSCREEN_CLIPBOARD_TARGET;
  text: string;
}

export interface OffscreenMarkdownMessage {
  target: typeof OFFSCREEN_MARKDOWN_TARGET;
  html: string;
  options: MarkdownConversionOptions;
}

export type OffscreenMessage = OffscreenClipboardMessage | OffscreenMarkdownMessage;

export interface OffscreenClipboardResponse {
  ok: boolean;
  error?: string;
}

export interface OffscreenMarkdownResponse {
  ok: boolean;
  markdown?: string;
  error?: string;
}
