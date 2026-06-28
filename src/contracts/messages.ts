/**
 * Shared runtime message contracts between popup/background/handlers.
 */
import type { ExportTabsOptions } from '../services/tab-export-service.js';

export type PendingPopupFeedbackCode = 'empty-result';

export interface BadgeMessage {
  topic: 'badge';
  params: { type: 'success' | 'fail' };
}

export interface ExportCurrentTabMessage {
  topic: 'export-current-tab';
  params: {
    tabId: number;
    format: 'link' | 'custom-format';
    customFormatSlot?: string | null;
  };
}

export interface ExportTabsMessage {
  topic: 'export-tabs';
  params: ExportTabsOptions;
}

export interface CopyToClipboardMessage {
  topic: 'copy-to-clipboard';
  params: { text: string };
}

export interface CheckMockClipboardMessage {
  topic: 'check-mock-clipboard';
  params: Record<string, never>;
}

export interface SetMockClipboardMessage {
  topic: 'set-mock-clipboard';
  params: { enabled: boolean };
}

export interface ConsumePendingPopupFeedbackMessage {
  topic: 'consume-pending-popup-feedback';
  params: Record<string, never>;
}

// e2e only: lets the Selenium readiness gate confirm the background's top-level
// listeners are registered. Chrome's service worker can't be flag-read directly
// (attaching a CDP debugger pauses the worker), so the suite probes via a message
// round-trip; this handler answers with the __listenersReady flag.
export interface ListenersReadyMessage {
  topic: 'e2e-listeners-ready';
  params: Record<string, never>;
}

export type RuntimeMessage
  = | BadgeMessage
    | ExportCurrentTabMessage
    | ExportTabsMessage
    | CopyToClipboardMessage
    | CheckMockClipboardMessage
    | SetMockClipboardMessage
    | ConsumePendingPopupFeedbackMessage
    | ListenersReadyMessage;

export type RuntimeMessageTopic = RuntimeMessage['topic'];

export type RuntimeMessageParams<TTopic extends RuntimeMessageTopic>
  = Extract<RuntimeMessage, { topic: TTopic }>['params'];
